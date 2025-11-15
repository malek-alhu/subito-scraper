import { query } from '../../utils/db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineEventHandler(async (event) => {
  try {
    console.log('Manual database initialization requested');

    // Check if tables already exist
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

    if (missingTables.length === 0) {
      return {
        success: true,
        message: 'Database already initialized',
        tables: existingTables
      };
    }

    console.log('Missing tables:', missingTables.join(', '));
    console.log('Creating database schema...');

    // Read and execute schema
    const schemaPath = join(__dirname, '../../database/schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');

    await query(schema);

    console.log('Database schema created successfully');

    // Verify tables were created
    const verifyResult = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    return {
      success: true,
      message: 'Database initialized successfully',
      tables: verifyResult.rows.map(r => r.table_name),
      createdTables: missingTables
    };

  } catch (error) {
    console.error('Database initialization error:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
});
