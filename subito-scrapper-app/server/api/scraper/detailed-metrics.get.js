import { supabase } from '../../utils/supabase'
import { SCRAPER_CONFIG } from '../../config/scraper'

export default defineEventHandler(async (event) => {
  try {
    // Get recent sessions with full details
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('scraping_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (sessionsError) throw sessionsError

    // Get total items count
    const { count: totalItems, error: itemsError } = await supabase
      .from('scraped_items')
      .select('*', { count: 'exact', head: true })

    if (itemsError) throw itemsError

    // Calculate performance stats
    const completedSessions = recentSessions.filter(s => s.status === 'completed')
    const failedSessions = recentSessions.filter(s => s.status === 'failed')
    const successRate = recentSessions.length > 0 
      ? (completedSessions.length / recentSessions.length) * 100 
      : 0

    // Calculate average duration for completed sessions
    const avgDuration = completedSessions.length > 0
      ? completedSessions.reduce((acc, session) => acc + (session.duration_ms || 0), 0) / completedSessions.length
      : 0

    // Get endpoint statistics
    const endpointStats = {
      url: SCRAPER_CONFIG.baseUrl,
      searchQuery: SCRAPER_CONFIG.searchParams.q,
      itemsPerPage: SCRAPER_CONFIG.pagination.itemsPerPage,
      requestDelay: SCRAPER_CONFIG.pagination.requestDelay,
      batchDelay: SCRAPER_CONFIG.pagination.batchDelay,
      schedule: SCRAPER_CONFIG.schedule.interval
    }

    // Calculate active and sold item counts
    const { count: activeCount, error: activeError } = await supabase
      .from('scraped_items')
      .select('id', { count: 'exact' })
      .eq('status', 'active')

    if (activeError) throw activeError

    const { count: soldCount, error: soldError } = await supabase
      .from('scraped_items')
      .select('id', { count: 'exact' })
      .eq('status', 'sold')

    if (soldError) throw soldError

    return {
      dbStats: {
        totalSessions: recentSessions.length,
        totalItems,
        activeItems: activeCount,
        soldItems: soldCount,
        storageSize: totalItems * 1024 // Rough estimate: 1KB per item
      },
      recentSessions: recentSessions.map(session => ({
        ...session,
        duration: session.duration_ms ? Math.floor(session.duration_ms / 1000) : null
      })),
      performanceStats: {
        avgItemsPerSession: completedSessions.length > 0
          ? Math.round(completedSessions.reduce((acc, s) => acc + s.total_items, 0) / completedSessions.length)
          : 0,
        successRate: Math.round(successRate * 100) / 100,
        avgDurationMs: Math.round(avgDuration),
        failureRate: recentSessions.length > 0 
          ? (failedSessions.length / recentSessions.length) * 100 
          : 0
      },
      endpointStats
    }
  } catch (error) {
    console.error('Error fetching detailed metrics:', error)
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }
}) 