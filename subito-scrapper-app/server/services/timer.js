import cron from 'node-cron'
import { initializeScheduler } from './scheduler'

// Create a singleton instance for the timer state
const timerState = {
  lastCheck: new Date().toISOString(),
  checkCount: 0,
  isInitialized: false,
  lastResults: null
}

async function scrapeSubito() {
  try {
    // TODO: Add your scraping logic here
    console.log('Scraping Subito...')
    
    // Example of what we'll do later:
    // const results = await fetch('https://www.subito.it/...')
    // timerState.lastResults = await results.json()
    
    return { success: true, message: 'Scraping completed' }
  } catch (error) {
    console.error('Scraping failed:', error)
    return { success: false, error: error.message }
  }
}

export function getTimerState() {
  return timerState
}

export function initializeTimer() {
  // Initialize the scraper scheduler
  initializeScheduler()

  // Prevent multiple initializations
  if (timerState.isInitialized) {
    console.log('Timer already initialized')
    return
  }

  // Run immediately on start
  scrapeSubito().then(result => {
    console.log('Initial scrape result:', result)
  })

  // Run every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    timerState.lastCheck = new Date().toISOString()
    timerState.checkCount++
    console.log(`Timer check #${timerState.checkCount} at ${timerState.lastCheck}`)
    
    const result = await scrapeSubito()
    console.log('Scheduled scrape result:', result)
  })

  timerState.isInitialized = true
  console.log('Timer initialized with immediate scraping')
}

// Auto-initialize when this module is imported
initializeTimer() 