import { runScraper } from '../services/scraper'

export default defineEventHandler(async (event) => {
  try {
    const result = await runScraper()
    return result
  } catch (error) {
    console.error('Scraping error:', error)
    return {
      success: false,
      message: error.message
    }
  }
}) 