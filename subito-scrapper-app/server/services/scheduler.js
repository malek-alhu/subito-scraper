import cron from 'node-cron'
import { runScraper } from './scraper'
import { SCRAPER_CONFIG } from '../config/scraper'
import { supabase } from '../utils/supabase'

// Metrics state
const scraperMetrics = {
  lastRun: null,
  totalSessions: 0,
  totalItemsScraped: 0,
  lastSessionStats: null,
  status: 'idle', // 'idle', 'running', 'error'
  error: null
}

class ScraperScheduler {
  constructor() {
    this.isInitialized = false
    this.cronJob = null
    
    // Handle graceful shutdown
    process.on('SIGTERM', this.handleShutdown.bind(this))
    process.on('SIGINT', this.handleShutdown.bind(this))
  }

  static instance = null

  static getInstance() {
    if (!ScraperScheduler.instance) {
      ScraperScheduler.instance = new ScraperScheduler()
    }
    return ScraperScheduler.instance
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('Scheduler already initialized')
      return
    }

    // Run immediately on startup
    await this.runScheduledScrape()

    // Schedule future runs
    this.cronJob = cron.schedule(SCRAPER_CONFIG.schedule.interval, async () => {
      console.log('Starting scheduled scrape...')
      await this.runScheduledScrape()
    })

    this.isInitialized = true
    console.log('Scheduler initialized')
  }

  async runScheduledScrape() {
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

  stop() {
    if (this.cronJob) {
      this.cronJob.stop()
    }
    this.isInitialized = false
  }

  async handleShutdown() {
    console.log('Shutting down scheduler...')
    if (this.cronJob) {
      this.cronJob.stop()
    }
    
    // Clean up any in-progress sessions
    try {
      await supabase
        .from('scraping_sessions')
        .update({ status: 'failed', error: 'Deployment restart' })
        .eq('status', 'in_progress')
    } catch (error) {
      console.error('Error cleaning up sessions:', error)
    }
  }
}

// Export the metrics getter
export function getScraperMetrics() {
  return scraperMetrics
}

// Export a function to get the scheduler instance
export function getScheduler() {
  return ScraperScheduler.getInstance()
}

// Initialize when the module is imported
getScheduler().initialize()