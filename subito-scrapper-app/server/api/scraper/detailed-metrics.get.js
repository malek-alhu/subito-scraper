import { supabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    // Get total sessions and items
    const { data: sessionStats, error: sessionError } = await supabase
      .from('scraping_sessions')
      .select('id, status')

    if (sessionError) throw sessionError

    // Get recent sessions
    const { data: recentSessions, error: recentError } = await supabase
      .from('scraping_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (recentError) throw recentError

    // Calculate performance stats
    const totalSessions = sessionStats.length
    const completedSessions = sessionStats.filter(s => s.status === 'completed').length
    const successRate = totalSessions ? (completedSessions / totalSessions) * 100 : 0

    // Get total items
    const { count: totalItems, error: itemsError } = await supabase
      .from('scraped_items')
      .select('*', { count: 'exact', head: true })

    if (itemsError) throw itemsError

    return {
      dbStats: {
        totalSessions,
        totalItems,
        storageSize: totalItems * 1024 // Rough estimate: 1KB per item
      },
      recentSessions,
      performanceStats: {
        avgItemsPerSession: totalSessions ? Math.round(totalItems / totalSessions) : 0,
        successRate: Math.round(successRate * 100) / 100,
        totalRuntime: totalSessions * 5 // Rough estimate: 5 minutes per session
      }
    }
  } catch (error) {
    console.error('Error fetching detailed metrics:', error)
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }
}) 