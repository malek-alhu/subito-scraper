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
    const batchStartTime = new Date()
    
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
      
      const currentTime = new Date()
      // Update session progress with percentage and duration
      await supabase
        .from('scraping_sessions')
        .update({ 
          processed_pages: page + 1,
          progress_percentage: Math.round(((page + 1) / totalPages) * 100),
          last_processed_at: currentTime.toISOString(),
          duration_ms: currentTime - batchStartTime,
          status: page + 1 === totalPages ? 'completed' : 'in_progress'
        })
        .eq('id', sessionId)
      
      console.log(`Processed page ${page + 1}/${totalPages}, Session ID: ${sessionId}`)
    }

    return true
  } catch (error) {
    console.error('Error processing batch:', error)
    // Update session as failed if error occurs
    const endTime = new Date()
    await supabase
      .from('scraping_sessions')
      .update({ 
        status: 'failed',
        error: error.message,
        completed_at: endTime.toISOString(),
        duration_ms: endTime - batchStartTime
      })
      .eq('id', sessionId)
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

async function cleanupStaleSessions() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  
  // Get all in-progress sessions
  const { data: inProgressSessions } = await supabase
    .from('scraping_sessions')
    .select('id, created_at')
    .eq('status', 'in_progress')

  if (inProgressSessions?.length > 0) {
    console.log(`Found ${inProgressSessions.length} in-progress sessions to cleanup`)
    
    // Mark all old in-progress sessions as failed
    const staleSessionIds = inProgressSessions
      .filter(s => new Date(s.created_at) < new Date(thirtyMinutesAgo))
      .map(s => s.id)

    if (staleSessionIds.length > 0) {
      const { error } = await supabase
        .from('scraping_sessions')
        .update({ 
          status: 'failed',
          error: 'Session timed out or was interrupted',
          completed_at: new Date().toISOString()
        })
        .in('id', staleSessionIds)

      if (error) {
        console.error('Error cleaning up stale sessions:', error)
      } else {
        console.log(`Cleaned up ${staleSessionIds.length} stale sessions`)
      }
    }

    // Also cleanup any recent in-progress sessions
    const recentSessionIds = inProgressSessions
      .filter(s => new Date(s.created_at) >= new Date(thirtyMinutesAgo))
      .map(s => s.id)

    if (recentSessionIds.length > 0) {
      const { error } = await supabase
        .from('scraping_sessions')
        .update({ 
          status: 'failed',
          error: 'Previous session was interrupted',
          completed_at: new Date().toISOString()
        })
        .in('id', recentSessionIds)

      if (error) {
        console.error('Error cleaning up recent sessions:', error)
      } else {
        console.log(`Cleaned up ${recentSessionIds.length} recent sessions`)
      }
    }
  }
}

export async function runScraper() {
  console.log('Starting new scraping process...')
  
  // First cleanup any existing sessions
  await cleanupStaleSessions()
  
  let session = null
  const startTime = new Date()
  
  try {
    // Create new session
    const { data: newSession, error: sessionError } = await supabase
      .from('scraping_sessions')
      .insert({
        search_query: SCRAPER_CONFIG.searchParams.q,
        total_items: 0,
        total_pages: 0,
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

    console.log(`Session ${session.id}: Found ${totalItems} items across ${totalPages} pages`)

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
      const success = await processBatch(batch, session.id, totalPages)
      if (!success) {
        throw new Error('Failed to process batch')
      }
      await sleep(SCRAPER_CONFIG.pagination.batchDelay)
    }

    // Final update with completion time and duration
    const endTime = new Date()
    const duration = endTime - startTime
    await supabase
      .from('scraping_sessions')
      .update({ 
        status: 'completed',
        completed_at: endTime.toISOString(),
        duration_ms: duration,
        processed_pages: totalPages,
        progress_percentage: 100
      })
      .eq('id', session.id)

    console.log(`Session ${session.id} completed successfully`)
    return { success: true, sessionId: session.id, totalItems, totalPages, duration }

  } catch (error) {
    console.error(`Session ${session?.id} failed:`, error)
    
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