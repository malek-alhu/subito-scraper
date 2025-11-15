import { runScraper } from '../../services/enhanced-scraper.js';
import { query } from '../../utils/db.js';
import { DATABASE_SCHEMA } from '../../database/schema.js';

async function ensureDatabaseInitialized() {
  try {
    // Check if tables exist
    const tablesResult = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('scraping_sessions', 'scraped_items', 'price_history', 'deal_alerts')
      ORDER BY table_name
    `);

    const existingTables = tablesResult.rows.map(r => r.table_name);
    const requiredTables = ['scraping_sessions', 'scraped_items', 'price_history', 'deal_alerts'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      console.log('Database not initialized. Creating schema...');
      console.log('Missing tables:', missingTables.join(', '));

      // Execute embedded schema
      await query(DATABASE_SCHEMA);

      console.log('✅ Database schema created successfully');
      return { initialized: true, created: true };
    }

    console.log('✅ Database already initialized');
    return { initialized: true, created: false };
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export default defineEventHandler(async (event) => {
  try {
    // Auto-initialize database if needed
    await ensureDatabaseInitialized();

    // Run scraper
    const result = await runScraper();
    return result;
  } catch (error) {
    console.error('Manual scrape error:', error);
    return {
      success: false,
      message: error.message,
      error: error.toString()
    };
  }
});
