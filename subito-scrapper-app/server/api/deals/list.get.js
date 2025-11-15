import { query } from '../../utils/db.js';

export default defineEventHandler(async (event) => {
  try {
    const queryParams = getQuery(event);
    const limit = parseInt(queryParams.limit) || 50;
    const offset = parseInt(queryParams.offset) || 0;
    const minScore = parseFloat(queryParams.minScore) || 0;
    const alertType = queryParams.type || null;

    let sql = `
      SELECT
        da.*,
        si.title,
        si.price,
        si.category,
        si.location,
        si.image_url,
        si.listing_url,
        si.seller_name,
        si.posted_at,
        si.data
      FROM deal_alerts da
      JOIN scraped_items si ON da.item_id = si.item_id
      WHERE da.is_dismissed = FALSE
      AND si.status = 'active'
      AND da.deal_score >= $1
    `;

    const params = [minScore];
    let paramCount = 1;

    if (alertType) {
      paramCount++;
      sql += ` AND da.alert_type = $${paramCount}`;
      params.push(alertType);
    }

    sql += ` ORDER BY da.deal_score DESC, da.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Get total count
    let countSql = `
      SELECT COUNT(*) as total
      FROM deal_alerts da
      JOIN scraped_items si ON da.item_id = si.item_id
      WHERE da.is_dismissed = FALSE
      AND si.status = 'active'
      AND da.deal_score >= $1
    `;

    const countParams = [minScore];
    if (alertType) {
      countSql += ` AND da.alert_type = $2`;
      countParams.push(alertType);
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0]?.total) || 0;

    return {
      success: true,
      deals: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  } catch (error) {
    console.error('Error fetching deals:', error);
    return {
      success: false,
      error: error.message,
      deals: []
    };
  }
});
