import { updateScraperConfig } from '../../services/enhanced-scraper.js';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const result = await updateScraperConfig(body);
    return result;
  } catch (error) {
    console.error('Config update error:', error);
    return {
      success: false,
      message: error.message
    };
  }
});
