import cron from 'node-cron';
import { runScraper, getScrapingStatus } from './enhanced-scraper.js';
import { SCRAPER_CONFIG } from '../config/scraper.js';
import { query } from '../utils/db.js';

// Metrics state
const scraperMetrics = {
  lastRun: null,
  totalSessions: 0,
  totalItemsScraped: 0,
  lastSessionStats: null,
  status: 'idle',
  error: null,
  nextRun: null
};

class ScraperScheduler {
  constructor() {
    this.isInitialized = false;
    this.cronJob = null;
  }

  static instance = null;

  static getInstance() {
    if (!ScraperScheduler.instance) {
      ScraperScheduler.instance = new ScraperScheduler();
    }
    return ScraperScheduler.instance;
  }

  calculateNextRun() {
    // Parse the cron expression to calculate next run time
    // For '0 */6 * * *', it runs every 6 hours at minute 0
    const now = new Date();
    const nextRun = new Date(now);

    // Get current hour
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Calculate next 6-hour mark (0, 6, 12, 18)
    const nextHourMark = Math.ceil((currentHour + 1) / 6) * 6;

    if (nextHourMark >= 24) {
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(0, 0, 0, 0);
    } else if (currentMinute > 0 && currentHour % 6 === 0) {
      // If we're past minute 0 of a 6-hour mark, go to next mark
      nextRun.setHours(currentHour + 6, 0, 0, 0);
    } else {
      nextRun.setHours(nextHourMark, 0, 0, 0);
    }

    return nextRun;
  }

  async runScheduledScrape() {
    const status = getScrapingStatus();

    if (status.isRunning) {
      console.log('Scraping already in progress, skipping...');
      return;
    }

    try {
      scraperMetrics.status = 'running';
      scraperMetrics.error = null;
      scraperMetrics.lastRun = new Date().toISOString();

      console.log('Starting scheduled scrape...');
      const result = await runScraper();

      if (result.success) {
        scraperMetrics.totalSessions++;
        scraperMetrics.totalItemsScraped += result.totalItems;
        scraperMetrics.lastSessionStats = {
          sessionId: result.sessionId,
          totalItems: result.totalItems,
          totalPages: result.totalPages,
          timestamp: new Date().toISOString()
        };
        scraperMetrics.status = 'idle';
        console.log(`✅ Scheduled scrape completed successfully (Session: ${result.sessionId})`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Scheduled scrape failed:', error);
      scraperMetrics.status = 'error';
      scraperMetrics.error = error.message;
    } finally {
      scraperMetrics.nextRun = this.calculateNextRun().toISOString();
      console.log(`Next scrape scheduled for: ${scraperMetrics.nextRun}`);
    }
  }

  async initializeDatabase() {
    try {
      console.log('Checking database connection...');

      // Test database connection
      const result = await query('SELECT NOW() as current_time');
      console.log('✓ Database connected:', result.rows[0].current_time);

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
        console.log('⚠️  Missing tables:', missingTables.join(', '));
        console.log('Creating database schema...');

        // Read and execute schema
        const { readFileSync } = await import('fs');
        const { fileURLToPath } = await import('url');
        const { dirname, join } = await import('path');

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const schemaPath = join(__dirname, '../database/schema.sql');

        const schema = readFileSync(schemaPath, 'utf8');
        await query(schema);

        console.log('✓ Database schema created successfully');
      } else {
        console.log('✓ All required tables exist');
      }

      return true;
    } catch (error) {
      console.error('❌ Database initialization error:', error.message);
      return false;
    }
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('Scheduler already initialized');
      return;
    }

    console.log('Initializing Subito Scraper Scheduler...');

    // Initialize database first
    const dbReady = await this.initializeDatabase();

    if (!dbReady) {
      console.error('❌ Database not ready. Scheduler will not start.');
      return;
    }

    // Calculate next run time
    scraperMetrics.nextRun = this.calculateNextRun().toISOString();
    console.log(`Next automatic scrape scheduled for: ${scraperMetrics.nextRun}`);

    // Run immediately on startup
    console.log('Running initial scrape...');
    await this.runScheduledScrape();

    // Schedule future runs (every 6 hours: 0 */6 * * *)
    this.cronJob = cron.schedule(SCRAPER_CONFIG.schedule.interval, async () => {
      await this.runScheduledScrape();
    });

    this.isInitialized = true;
    console.log('✅ Scheduler initialized successfully');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
    }
    this.isInitialized = false;
    console.log('Scheduler stopped');
  }
}

// Export the metrics getter
export function getScraperMetrics() {
  return scraperMetrics;
}

// Create and export a single scheduler instance
const scheduler = ScraperScheduler.getInstance();

// Initialize only once
if (!scheduler.isInitialized) {
  scheduler.initialize().catch(err => {
    console.error('Failed to initialize scheduler:', err);
  });
}

export { scheduler };
