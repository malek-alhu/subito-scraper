import { query } from '../../utils/db.js';

export default defineEventHandler(async (event) => {
  try {
    // Test database connection
    const timeResult = await query('SELECT NOW() as current_time');

    // Check if tables exist
    const tablesResult = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const existingTables = tablesResult.rows.map(r => r.table_name);
    const requiredTables = ['scraping_sessions', 'scraped_items', 'price_history', 'deal_alerts'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    // Get counts if tables exist
    const counts = {};
    for (const table of existingTables) {
      try {
        const countResult = await query(`SELECT COUNT(*) as count FROM ${table}`);
        counts[table] = parseInt(countResult.rows[0]?.count) || 0;
      } catch (err) {
        counts[table] = 'error';
      }
    }

    return {
      success: true,
      connected: true,
      serverTime: timeResult.rows[0]?.current_time,
      database: {
        existingTables,
        missingTables,
        isInitialized: missingTables.length === 0,
        tableCounts: counts
      }
    };

  } catch (error) {
    console.error('Database status check error:', error);
    return {
      success: false,
      connected: false,
      error: error.message
    };
  }
});
