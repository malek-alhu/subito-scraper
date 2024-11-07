import cron from 'node-cron'
import { runScraper } from './scraper'
import { SCRAPER_CONFIG } from '../config/scraper'
import { supabase } from '../utils/supabase'

// Global flag to prevent multiple scrapes
let isScrapingInProgress = false

// Metrics state
const scraperMetrics = {
  lastRun: null,
  totalSessions: 0,
  totalItemsScraped: 0,
  lastSessionStats: null,
  status: 'idle',
  error: null
}

class ScraperScheduler {
  constructor() {
    this.isInitialized = false
    this.cronJob = null
  }

  static instance = null

  static getInstance() {
    if (!ScraperScheduler.instance) {
      ScraperScheduler.instance = new ScraperScheduler()
    }
    return ScraperScheduler.instance
  }

  async runScheduledScrape() {
    // Check if scraping is already in progress
    if (isScrapingInProgress) {
      console.log('Scraping already in progress, skipping...')
      return
    }

    try {
      isScrapingInProgress = true
      scraperMetrics.status = 'running'
      scraperMetrics.error = null
      scraperMetrics.lastRun = new Date().toISOString()

      console.log('Starting scheduled scrape...')
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
    } finally {
      isScrapingInProgress = false
      console.log('Scraping process finished')
    }
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('Scheduler already initialized')
      return
    }

    console.log('Initializing scheduler...')

    // Run immediately on startup
    await this.runScheduledScrape()

    // Schedule future runs
    this.cronJob = cron.schedule(SCRAPER_CONFIG.schedule.interval, async () => {
      await this.runScheduledScrape()
    })

    this.isInitialized = true
    console.log('Scheduler initialized')
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop()
    }
    this.isInitialized = false
    console.log('Scheduler stopped')
  }
}

// Export the metrics getter
export function getScraperMetrics() {
  return scraperMetrics
}

// Create and export a single scheduler instance
const scheduler = ScraperScheduler.getInstance()

// Initialize only once
if (!scheduler.isInitialized) {
  scheduler.initialize()
}

export { scheduler }