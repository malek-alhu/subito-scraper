import { query } from '../../utils/db.js';

export default defineEventHandler(async (event) => {
  try {
    const itemId = getRouterParam(event, 'itemId');

    if (!itemId) {
      throw new Error('Item ID is required');
    }

    // Get price history
    const historyResult = await query(`
      SELECT *
      FROM price_history
      WHERE item_id = $1
      ORDER BY recorded_at DESC
      LIMIT 50
    `, [itemId]);

    // Get item details
    const itemResult = await query(`
      SELECT *
      FROM scraped_items
      WHERE item_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [itemId]);

    return {
      success: true,
      item: itemResult.rows[0] || null,
      history: historyResult.rows
    };
  } catch (error) {
    console.error('Error fetching price history:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
