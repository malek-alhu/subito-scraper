import { query } from '../../utils/db.js';

export default defineEventHandler(async (event) => {
  try {
    // Get deal statistics
    const statsResult = await query(`
      SELECT
        COUNT(*) as total_deals,
        COUNT(CASE WHEN alert_type = 'great_deal' THEN 1 END) as great_deals,
        COUNT(CASE WHEN alert_type = 'price_drop' THEN 1 END) as price_drops,
        COUNT(CASE WHEN alert_type = 'below_average' THEN 1 END) as below_average,
        AVG(deal_score) as avg_deal_score,
        MAX(deal_score) as max_deal_score,
        COUNT(CASE WHEN is_notified = TRUE THEN 1 END) as notified_deals,
        COUNT(CASE WHEN is_dismissed = TRUE THEN 1 END) as dismissed_deals
      FROM deal_alerts
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    // Get price drop statistics
    const priceDropsResult = await query(`
      SELECT
        COUNT(*) as total_price_drops,
        AVG(price_change_percentage) as avg_price_drop,
        MIN(price_change_percentage) as max_price_drop_percentage,
        SUM(ABS(price_change)) as total_savings
      FROM price_history
      WHERE price_change < 0
      AND recorded_at > NOW() - INTERVAL '7 days'
    `);

    // Get category-wise deal distribution
    const categoryResult = await query(`
      SELECT
        si.category,
        COUNT(da.id) as deal_count,
        AVG(da.deal_score) as avg_deal_score
      FROM deal_alerts da
      JOIN scraped_items si ON da.item_id = si.item_id
      WHERE da.created_at > NOW() - INTERVAL '7 days'
      AND da.is_dismissed = FALSE
      GROUP BY si.category
      ORDER BY deal_count DESC
      LIMIT 10
    `);

    return {
      success: true,
      stats: {
        deals: statsResult.rows[0],
        priceDrops: priceDropsResult.rows[0],
        byCategory: categoryResult.rows
      }
    };
  } catch (error) {
    console.error('Error fetching deal stats:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
