import { runScraper } from '../../services/enhanced-scraper.js';

export default defineEventHandler(async (event) => {
  try {
    const result = await runScraper();
    return result;
  } catch (error) {
    console.error('Manual scrape error:', error);
    return {
      success: false,
      message: error.message
    };
  }
});
