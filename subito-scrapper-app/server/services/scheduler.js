import cron from 'node-cron'
import { runScraper } from './scraper'
import { SCRAPER_CONFIG } from '../config/scraper'

// Metrics state
const scraperMetrics = {
  lastRun: null,
  totalSessions: 0,
  totalItemsScraped: 0,
  lastSessionStats: null,
  status: 'idle', // 'idle', 'running', 'error'
  error: null
}

export function getScraperMetrics() {
  return scraperMetrics
}

async function runScheduledScrape() {
  try {
    scraperMetrics.status = 'running'
    scraperMetrics.error = null
    scraperMetrics.lastRun = new Date().toISOString()

    const result = await runScraper()
    
    if (result.success) {
      scraperMetrics.totalSessions++
      scraperMetrics.totalItemsScraped += result.totalItems
      scraperMetrics.lastSessionStats = {
        sessionId: result.sessionId,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        timestamp: new Date().toISOString()
      }
      scraperMetrics.status = 'idle'
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    console.error('Scheduled scrape failed:', error)
    scraperMetrics.status = 'error'
    scraperMetrics.error = error.message
  }
}

export function initializeScheduler() {
  // Run immediately on startup
  runScheduledScrape()

  // Schedule future runs (every 6 hours)
  cron.schedule(SCRAPER_CONFIG.schedule.interval, async () => {
    console.log('Starting scheduled scrape...')
    await runScheduledScrape()
  })
}

// Initialize when the module is imported
initializeScheduler() 