import { supabase } from '../utils/supabase'
import { SCRAPER_CONFIG } from '../config/scraper'

let isScrapingInProgress = false

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPage(page) {
  const start = page * SCRAPER_CONFIG.pagination.itemsPerPage
  const params = new URLSearchParams({
    ...SCRAPER_CONFIG.searchParams,
    start: start.toString(),
    lim: SCRAPER_CONFIG.pagination.itemsPerPage.toString()
  })

  const response = await fetch(`${SCRAPER_CONFIG.baseUrl}?${params}`)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.json()
}

async function processBatch(pages, sessionId, totalPages) {
  try {
    // Process pages concurrently in groups of 10
    const pageGroups = [];
    for (let i = 0; i < pages.length; i += 10) {
      pageGroups.push(pages.slice(i, i + 10));
    }

    for (const group of pageGroups) {
      // Process all pages in group concurrently
      await Promise.all(group.map(async (page) => {
        try {
          const result = await fetchPage(page)
          
          const items = result.ads.map(ad => ({
            session_id: sessionId,
            item_id: ad.urn,
            data: ad
          }))

          await supabase
            .from('scraped_items')
            .upsert(items, { 
              onConflict: 'item_id,session_id',
              ignoreDuplicates: true 
            })

          console.log(`Processed page ${page + 1}/${totalPages}, Session ID: ${sessionId}`)
          
          // Update progress after each page
          await supabase
            .from('scraping_sessions')
            .update({ 
              processed_pages: page + 1,
              progress_percentage: Math.round(((page + 1) / totalPages) * 100),
              last_processed_at: new Date().toISOString()
            })
            .eq('id', sessionId)

        } catch (error) {
          console.error(`Error processing page ${page + 1}:`, error)
          throw error
        }
      }))

      // 100ms delay between groups
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return true
  } catch (error) {
    console.error('Error processing batch:', error)
    return false
  }
}

export async function saveScrapingResult(data) {
  try {
    // First save the main scraping result
    const { data: scrapingResult, error: scrapingError } = await supabase
      .from('scraping_sessions')
      .insert({
        search_query: SCRAPER_CONFIG.searchParams.q,
        total_items: data.count_all,
        total_pages: Math.ceil(data.count_all / SCRAPER_CONFIG.pagination.itemsPerPage),
        status: 'in_progress'
      })
      .select()
      .single()

    if (scrapingError) throw scrapingError

    // Then save each ad
    const adsToInsert = data.ads.map(ad => ({
      session_id: scrapingResult.id,
      item_id: ad.urn,
      data: ad
    }))

    const { error: adsError } = await supabase
      .from('scraped_items')
      .upsert(adsToInsert, {
        onConflict: 'item_id,session_id',
        ignoreDuplicates: true
      })

    if (adsError) throw adsError

    // Update session status to completed
    await supabase
      .from('scraping_sessions')
      .update({ status: 'completed' })
      .eq('id', scrapingResult.id)

    return {
      success: true,
      sessionId: scrapingResult.id,
      totalItems: data.count_all,
      totalPages: Math.ceil(data.count_all / SCRAPER_CONFIG.pagination.itemsPerPage)
    }
  } catch (error) {
    console.error('Error saving scraping result:', error)
    return { success: false, error: error.message }
  }
}

async function cleanupOldSessions() {
  try {
    // Clean up any sessions with 0 items/pages
    await supabase
      .from('scraping_sessions')
      .update({ 
        status: 'failed',
        error: 'Invalid session: No items found',
        completed_at: new Date().toISOString()
      })
      .eq('status', 'in_progress')
      .eq('total_items', 0)

    // Clean up stale sessions
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    await supabase
      .from('scraping_sessions')
      .update({ 
        status: 'failed',
        error: 'Session timed out',
        completed_at: new Date().toISOString()
      })
      .eq('status', 'in_progress')
      .lt('created_at', thirtyMinutesAgo)

  } catch (error) {
    console.error('Cleanup error:', error)
  }
}

export async function runScraper() {
  await cleanupOldSessions()
  
  let session = null
  const startTime = new Date()
  
  try {
    // Get initial data BEFORE creating session
    const initialData = await fetchPage(0)
    const totalItems = initialData.count_all
    const totalPages = Math.ceil(totalItems / SCRAPER_CONFIG.pagination.itemsPerPage)

    // Validate we have data before creating session
    if (!totalItems || totalItems === 0 || !totalPages || totalPages === 0) {
      throw new Error('No items found to scrape')
    }

    console.log(`Found ${totalItems} items across ${totalPages} pages`)

    // Create session only after confirming we have data
    const { data: newSession, error: sessionError } = await supabase
      .from('scraping_sessions')
      .insert({
        search_query: SCRAPER_CONFIG.searchParams.q,
        total_items: totalItems,
        total_pages: totalPages,
        processed_pages: 0,
        progress_percentage: 0,
        status: 'in_progress',
        created_at: startTime.toISOString(),
        start_time: startTime.toISOString(),
        duration_ms: 0
      })
      .select()
      .single()

    if (sessionError) throw sessionError
    session = newSession
    console.log(`Created new session: ${session.id}`)

    // Process pages in batches of 10
    const batches = []
    for (let i = 0; i < totalPages; i += 10) {
      const pages = Array.from(
        { length: Math.min(10, totalPages - i) },
        (_, index) => i + index
      )
      batches.push(pages)
    }

    for (const batch of batches) {
      const success = await processBatch(batch, session.id, totalPages)
      if (!success) {
        throw new Error('Failed to process batch')
      }
    }

    // Mark session as completed
    const endTime = new Date()
    await supabase
      .from('scraping_sessions')
      .update({ 
        status: 'completed',
        completed_at: endTime.toISOString(),
        duration_ms: endTime - startTime,
        processed_pages: totalPages,
        progress_percentage: 100
      })
      .eq('id', session.id)

    console.log(`Session ${session.id} completed successfully`)
    return { success: true, sessionId: session.id, totalItems, totalPages }

  } catch (error) {
    console.error(`Scraping error:`, error)
    
    if (session?.id) {
      const endTime = new Date()
      await supabase
        .from('scraping_sessions')
        .update({ 
          status: 'failed',
          completed_at: endTime.toISOString(),
          duration_ms: endTime - startTime,
          error: error.message
        })
        .eq('id', session.id)
    }

    return { success: false, error: error.message }
  }
}

export async function updateScraperConfig(newConfig) {
  try {
    // Validate config
    if (!newConfig || typeof newConfig !== 'object') {
      throw new Error('Invalid configuration object')
    }

    if (!newConfig.query || typeof newConfig.query !== 'string') {
      throw new Error('Search query must be a non-empty string')
    }

    const query = newConfig.query.trim()
    if (query === '') {
      throw new Error('Search query cannot be empty')
    }

    const itemsPerPage = parseInt(newConfig.itemsPerPage)
    if (isNaN(itemsPerPage) || itemsPerPage < 1 || itemsPerPage > 100) {
      throw new Error('Items per page must be between 1 and 100')
    }

    // Update config
    SCRAPER_CONFIG.searchParams.q = query
    SCRAPER_CONFIG.pagination.itemsPerPage = itemsPerPage

    return {
      success: true,
      config: {
        query: SCRAPER_CONFIG.searchParams.q,
        itemsPerPage: SCRAPER_CONFIG.pagination.itemsPerPage
      }
    }
  } catch (error) {
    console.error('Config update error:', error)
    return {
      success: false,
      error: error.message
    }
  }
} 