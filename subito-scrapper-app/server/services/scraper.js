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

async function processBatch(pages, sessionId) {
  try {
    // Process pages sequentially with delay
    for (const page of pages) {
      // Add delay before each request
      await sleep(SCRAPER_CONFIG.pagination.requestDelay)
      
      const result = await fetchPage(page)
      
      const items = result.ads.map(ad => ({
        session_id: sessionId,
        item_id: ad.urn,
        data: ad
      }))

      const { error } = await supabase
        .from('scraped_items')
        .upsert(items, { 
          onConflict: 'item_id,session_id',
          ignoreDuplicates: true 
        })

      if (error) throw error
      
      // Log progress
      console.log(`Processed page ${page + 1}`)
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

export async function runScraper() {
  // Prevent concurrent scraping
  if (isScrapingInProgress) {
    console.log('Scraping already in progress, skipping...')
    return {
      success: false,
      error: 'Scraping already in progress'
    }
  }

  try {
    isScrapingInProgress = true

    // Check for existing in_progress sessions and clean them up
    const { data: existingSessions, error: checkError } = await supabase
      .from('scraping_sessions')
      .select('id')
      .eq('status', 'in_progress')

    if (!checkError && existingSessions?.length > 0) {
      await supabase
        .from('scraping_sessions')
        .update({ status: 'failed' })
        .eq('status', 'in_progress')
    }

    // Start a new scraping session
    const { data: session, error: sessionError } = await supabase
      .from('scraping_sessions')
      .insert({
        search_query: SCRAPER_CONFIG.searchParams.q,
        total_items: 0,
        total_pages: 0,
        status: 'in_progress'
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    // Get initial data to determine total pages
    const initialData = await fetchPage(0)
    const totalItems = initialData.count_all
    const totalPages = Math.ceil(totalItems / SCRAPER_CONFIG.pagination.itemsPerPage)

    // Update session with totals
    await supabase
      .from('scraping_sessions')
      .update({
        total_items: totalItems,
        total_pages: totalPages
      })
      .eq('id', session.id)

    // Process all pages in batches
    const batches = []
    for (let i = 0; i < totalPages; i += SCRAPER_CONFIG.pagination.maxConcurrentRequests) {
      const pages = Array.from(
        { length: Math.min(SCRAPER_CONFIG.pagination.maxConcurrentRequests, totalPages - i) },
        (_, index) => i + index
      )
      batches.push(pages)
    }

    for (const batch of batches) {
      await processBatch(batch, session.id)
      // Add delay between batches
      await sleep(SCRAPER_CONFIG.pagination.batchDelay)
    }

    // Update session status to completed
    await supabase
      .from('scraping_sessions')
      .update({ status: 'completed' })
      .eq('id', session.id)

    return {
      success: true,
      sessionId: session.id,
      totalItems,
      totalPages
    }
  } catch (error) {
    console.error('Scraping error:', error)
    return {
      success: false,
      error: error.message
    }
  } finally {
    isScrapingInProgress = false
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