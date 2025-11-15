import { query } from '../../utils/db.js';
import { SCRAPER_CONFIG } from '../../config/scraper.js';

export default defineEventHandler(async (event) => {
  try {
    // Check if tables exist first
    const tablesCheck = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'scraping_sessions'
    `);

    if (tablesCheck.rows.length === 0) {
      return {
        error: 'Database not initialized',
        message: 'Please initialize the database first by calling POST /api/db/init',
        dbStats: { totalSessions: 0, totalItems: 0, storageSize: 0 },
        recentSessions: [],
        performanceStats: { avgItemsPerSession: 0, successRate: 0, avgDurationMs: 0, failureRate: 0 },
        recentErrors: [],
        endpointStats: {
          url: SCRAPER_CONFIG.baseUrl,
          searchQuery: SCRAPER_CONFIG.searchParams.q,
          itemsPerPage: SCRAPER_CONFIG.pagination.itemsPerPage,
          requestDelay: SCRAPER_CONFIG.pagination.requestDelay,
          batchDelay: SCRAPER_CONFIG.pagination.batchDelay,
          schedule: SCRAPER_CONFIG.schedule.interval
        }
      };
    }

    // Get recent sessions
    const sessionsResult = await query(`
      SELECT *
      FROM scraping_sessions
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const recentSessions = sessionsResult.rows;

    // Get total items count
    const itemsCountResult = await query(`
      SELECT COUNT(*) as total
      FROM scraped_items
    `);

    const totalItems = parseInt(itemsCountResult.rows[0]?.total) || 0;

    // Calculate performance stats
    const completedSessions = recentSessions.filter(s => s.status === 'completed');
    const failedSessions = recentSessions.filter(s => s.status === 'failed');
    const successRate = recentSessions.length > 0
      ? (completedSessions.length / recentSessions.length) * 100
      : 0;

    // Calculate average duration
    const avgDuration = completedSessions.length > 0
      ? completedSessions.reduce((acc, session) => acc + (session.duration_ms || 0), 0) / completedSessions.length
      : 0;

    // Get error summary
    const errorsResult = await query(`
      SELECT error, COUNT(*) as count
      FROM scraping_sessions
      WHERE status = 'failed'
      AND error IS NOT NULL
      GROUP BY error
      ORDER BY count DESC
      LIMIT 5
    `);

    const endpointStats = {
      url: SCRAPER_CONFIG.baseUrl,
      searchQuery: SCRAPER_CONFIG.searchParams.q,
      itemsPerPage: SCRAPER_CONFIG.pagination.itemsPerPage,
      requestDelay: SCRAPER_CONFIG.pagination.requestDelay,
      batchDelay: SCRAPER_CONFIG.pagination.batchDelay,
      schedule: SCRAPER_CONFIG.schedule.interval
    };

    return {
      dbStats: {
        totalSessions: recentSessions.length,
        totalItems,
        storageSize: totalItems * 1024
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
      recentErrors: errorsResult.rows,
      endpointStats
    };
  } catch (error) {
    console.error('Error fetching detailed metrics:', error);
    throw createError({
      statusCode: 500,
      message: error.message
    });
  }
});
