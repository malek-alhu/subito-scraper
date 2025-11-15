import { query } from '../../utils/db.js';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { dealId, itemId } = body;

    if (!dealId && !itemId) {
      throw new Error('Either dealId or itemId is required');
    }

    let sql, params;

    if (dealId) {
      sql = `
        UPDATE deal_alerts
        SET is_dismissed = TRUE
        WHERE id = $1
        RETURNING *
      `;
      params = [dealId];
    } else {
      sql = `
        UPDATE deal_alerts
        SET is_dismissed = TRUE
        WHERE item_id = $1
        RETURNING *
      `;
      params = [itemId];
    }

    const result = await query(sql, params);

    return {
      success: true,
      dismissed: result.rows.length
    };
  } catch (error) {
    console.error('Error dismissing deal:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
