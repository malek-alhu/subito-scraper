import { db, query } from '../utils/db.js';
import { SCRAPER_CONFIG } from '../config/scraper.js';

let isScrapingInProgress = false;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract structured data from ad object
function extractItemData(ad) {
  // Extract price
  const priceValue = ad.features?.find(f => f.uri === '/price')?.values?.[0]?.value;
  const price = priceValue ? parseFloat(priceValue) : null;

  // Extract category
  const category = ad.category?.name || null;

  // Extract location
  const town = ad.geo?.town?.value || '';
  const city = ad.geo?.city?.value || '';
  const region = ad.geo?.region?.value || '';
  const location = [town, city, region].filter(Boolean).join(', ');

  // Extract seller info
  const sellerName = ad.advertiser?.name || 'Unknown';
  const sellerId = ad.advertiser?.advertiser_id || ad.advertiser?.user_id || null;

  // Extract images
  const imageUrl = ad.images?.[0]?.scale?.['400x300']?.uri || ad.images?.[0]?.uri || null;

  // Extract URLs
  const listingUrl = ad.urls?.[0]?.href || `https://www.subito.it${ad.url}` || null;

  // Extract posted date
  const postedAt = ad.dates?.find(d => d.label === 'Prima pubblicazione')?.value ||
                   ad.dates?.[0]?.value ||
                   new Date().toISOString();

  // Check if sold
  const transactionStatus = ad.features?.find(f => f.uri === '/transaction_status');
  const isSold = transactionStatus?.values?.some(v => v.value === 'SOLD') || false;

  return {
    title: ad.subject || ad.body?.substring(0, 200) || 'No title',
    price,
    original_price: price, // Will be used for comparison
    category,
    location,
    seller_name: sellerName,
    seller_id: sellerId,
    image_url: imageUrl,
    listing_url: listingUrl,
    posted_at: postedAt,
    status: isSold ? 'sold' : 'active',
    data: ad
  };
}

// Calculate deal score based on various factors
async function calculateDealScore(item, sessionId) {
  try {
    // Get average price for similar items (same category, last 30 days)
    const avgResult = await query(`
      SELECT AVG(price) as avg_price, COUNT(*) as count
      FROM scraped_items
      WHERE category = $1
      AND status = 'active'
      AND price > 0
      AND created_at > NOW() - INTERVAL '30 days'
    `, [item.category]);

    const avgPrice = parseFloat(avgResult.rows[0]?.avg_price) || null;
    const count = parseInt(avgResult.rows[0]?.count) || 0;

    if (!avgPrice || count < 5 || !item.price) {
      return null; // Not enough data to calculate deal score
    }

    // Calculate price difference
    const priceDifference = avgPrice - item.price;
    const priceDifferencePercentage = (priceDifference / avgPrice) * 100;

    // Calculate deal score (0-100)
    // Higher score = better deal
    let dealScore = 0;

    if (priceDifferencePercentage > 0) {
      // Item is below average price
      dealScore = Math.min(100, priceDifferencePercentage * 2);
    } else {
      // Item is above average price
      dealScore = 0;
    }

    return {
      dealScore,
      avgPrice,
      priceDifference,
      priceDifferencePercentage
    };
  } catch (error) {
    console.error('Error calculating deal score:', error);
    return null;
  }
}

// Create deal alert if item is a good deal
async function createDealAlert(item, dealInfo) {
  try {
    let alertType = 'new_listing';
    const dealScore = dealInfo?.dealScore || 0;

    if (dealScore >= 50) {
      alertType = 'great_deal';
    } else if (dealScore >= 20) {
      alertType = 'below_average';
    }

    // Only create alert if it's a good deal
    if (dealScore >= 20) {
      await query(`
        INSERT INTO deal_alerts
        (item_id, alert_type, deal_score, price, average_price, price_difference, price_difference_percentage, title, listing_url, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (item_id, alert_type) DO UPDATE
        SET deal_score = EXCLUDED.deal_score,
            price = EXCLUDED.price,
            average_price = EXCLUDED.average_price,
            price_difference = EXCLUDED.price_difference,
            price_difference_percentage = EXCLUDED.price_difference_percentage,
            created_at = CURRENT_TIMESTAMP
      `, [
        item.item_id,
        alertType,
        dealScore,
        item.price,
        dealInfo.avgPrice,
        dealInfo.priceDifference,
        dealInfo.priceDifferencePercentage,
        item.title,
        item.listing_url,
        item.image_url
      ]);

      console.log(`✓ Created ${alertType} alert for item ${item.item_id} (score: ${dealScore.toFixed(1)})`);
    }
  } catch (error) {
    console.error('Error creating deal alert:', error);
  }
}

// Track price changes
async function trackPriceChange(item, sessionId) {
  try {
    // Get previous price for this item
    const prevResult = await query(`
      SELECT price, created_at
      FROM scraped_items
      WHERE item_id = $1
      AND id != (SELECT id FROM scraped_items WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1)
      ORDER BY created_at DESC
      LIMIT 1
    `, [item.item_id]);

    const previousPrice = prevResult.rows[0]?.price;

    if (previousPrice && item.price && previousPrice !== item.price) {
      const priceChange = item.price - previousPrice;
      const priceChangePercentage = (priceChange / previousPrice) * 100;

      // Record price history
      await query(`
        INSERT INTO price_history (item_id, price, previous_price, price_change, price_change_percentage, session_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        item.item_id,
        item.price,
        previousPrice,
        priceChange,
        priceChangePercentage,
        sessionId
      ]);

      console.log(`✓ Price changed for ${item.item_id}: €${previousPrice} → €${item.price} (${priceChangePercentage > 0 ? '+' : ''}${priceChangePercentage.toFixed(1)}%)`);

      // If price dropped significantly, create alert
      if (priceChangePercentage < -10) {
        const dealInfo = await calculateDealScore(item, sessionId);
        await query(`
          INSERT INTO deal_alerts
          (item_id, alert_type, deal_score, price, average_price, price_difference, price_difference_percentage, title, listing_url, image_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (item_id, alert_type) DO UPDATE
          SET deal_score = EXCLUDED.deal_score,
              price = EXCLUDED.price,
              created_at = CURRENT_TIMESTAMP
        `, [
          item.item_id,
          'price_drop',
          dealInfo?.dealScore || Math.abs(priceChangePercentage),
          item.price,
          dealInfo?.avgPrice || previousPrice,
          priceChange,
          priceChangePercentage,
          item.title,
          item.listing_url,
          item.image_url
        ]);

        console.log(`✓ Created price_drop alert for ${item.item_id}`);
      }
    }
  } catch (error) {
    console.error('Error tracking price change:', error);
  }
}

async function fetchPage(page) {
  const start = page * SCRAPER_CONFIG.pagination.itemsPerPage;
  const params = new URLSearchParams({
    ...SCRAPER_CONFIG.searchParams,
    start: start.toString(),
    lim: SCRAPER_CONFIG.pagination.itemsPerPage.toString()
  });

  const response = await fetch(`${SCRAPER_CONFIG.baseUrl}?${params}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}

async function processBatch(pages, sessionId, totalPages, scanStartedAt) {
  try {
    const pageGroups = [];
    for (let i = 0; i < pages.length; i += 10) {
      pageGroups.push(pages.slice(i, i + 10));
    }

    for (const group of pageGroups) {
      await Promise.all(group.map(async (page) => {
        try {
          const result = await fetchPage(page);

          for (const ad of result.ads) {
            const extractedData = extractItemData(ad);
            const item = {
              session_id: sessionId,
              item_id: ad.urn,
              last_checked_at: new Date().toISOString(),
              ...extractedData
            };

            // Upsert item
            const upsertResult = await query(`
              INSERT INTO scraped_items
              (session_id, item_id, data, status, last_checked_at, title, price, original_price, category, location, seller_name, seller_id, image_url, listing_url, posted_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              ON CONFLICT (item_id, session_id)
              DO UPDATE SET
                data = EXCLUDED.data,
                status = EXCLUDED.status,
                last_checked_at = EXCLUDED.last_checked_at,
                price = EXCLUDED.price,
                updated_at = CURRENT_TIMESTAMP
              RETURNING *
            `, [
              item.session_id,
              item.item_id,
              JSON.stringify(item.data),
              item.status,
              item.last_checked_at,
              item.title,
              item.price,
              item.original_price,
              item.category,
              item.location,
              item.seller_name,
              item.seller_id,
              item.image_url,
              item.listing_url,
              item.posted_at
            ]);

            const savedItem = upsertResult.rows[0];

            // Track price changes
            if (savedItem && item.price) {
              await trackPriceChange(savedItem, sessionId);
            }

            // Calculate deal score and create alerts for new/good deals
            if (savedItem && item.status === 'active' && item.price) {
              const dealInfo = await calculateDealScore(savedItem, sessionId);
              if (dealInfo) {
                await createDealAlert(savedItem, dealInfo);
              }
            }
          }

          console.log(`✓ Processed page ${page + 1}/${totalPages}`);

          // Update session progress
          await query(`
            UPDATE scraping_sessions
            SET processed_pages = $1,
                progress_percentage = $2,
                last_processed_at = $3
            WHERE id = $4
          `, [
            page + 1,
            Math.round(((page + 1) / totalPages) * 100),
            new Date().toISOString(),
            sessionId
          ]);

        } catch (error) {
          console.error(`Error processing page ${page + 1}:`, error);
          throw error;
        }
      }));

      await sleep(1000); // Delay between batches
    }

    return true;
  } catch (error) {
    console.error('Error processing batch:', error);
    return false;
  }
}

async function markSoldItems(scanStartedAt) {
  try {
    const BATCH_SIZE = 50;

    // Get stale items
    const staleResult = await query(`
      SELECT item_id
      FROM scraped_items
      WHERE last_checked_at < $1
      AND status = 'active'
    `, [scanStartedAt]);

    const staleItems = staleResult.rows;

    if (staleItems.length > 0) {
      for (let i = 0; i < staleItems.length; i += BATCH_SIZE) {
        const batch = staleItems.slice(i, i + BATCH_SIZE);
        const itemIds = batch.map(item => item.item_id);

        await query(`
          UPDATE scraped_items
          SET status = 'sold',
              last_checked_at = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE item_id = ANY($2::varchar[])
        `, [new Date().toISOString(), itemIds]);

        if (i + BATCH_SIZE < staleItems.length) {
          await sleep(100);
        }
      }

      console.log(`✓ Marked ${staleItems.length} items as sold`);
    }
  } catch (error) {
    console.error('Error marking sold items:', error);
  }
}

async function cleanupStaleSessions() {
  try {
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - FIFTEEN_MINUTES_MS);

    const result = await query(`
      UPDATE scraping_sessions
      SET status = 'failed',
          completed_at = CURRENT_TIMESTAMP,
          error = 'Session timed out after 15 minutes'
      WHERE status = 'in_progress'
      AND progress_percentage = 0
      AND created_at < $1
      RETURNING id
    `, [cutoffTime.toISOString()]);

    if (result.rows.length > 0) {
      console.log(`✓ Marked ${result.rows.length} stale sessions as failed`);
    }
  } catch (error) {
    console.error('Error cleaning up stale sessions:', error);
  }
}

export async function runScraper() {
  if (isScrapingInProgress) {
    return { success: false, error: 'Scraping already in progress' };
  }

  isScrapingInProgress = true;
  await cleanupStaleSessions();

  let session = null;
  const startTime = new Date();

  try {
    // Get initial data
    console.log('Fetching initial page...');
    const initialData = await fetchPage(0);
    const totalItems = initialData.count_all;
    const totalPages = Math.ceil(totalItems / SCRAPER_CONFIG.pagination.itemsPerPage);

    if (!totalItems || totalItems === 0) {
      throw new Error('No items found to scrape');
    }

    console.log(`✓ Found ${totalItems} items across ${totalPages} pages`);

    // Create session
    const sessionResult = await query(`
      INSERT INTO scraping_sessions
      (search_query, total_items, total_pages, processed_pages, progress_percentage, status, created_at, start_time, duration_ms)
      VALUES ($1, $2, $3, 0, 0, 'in_progress', $4, $4, 0)
      RETURNING *
    `, [
      SCRAPER_CONFIG.searchParams.q,
      totalItems,
      totalPages,
      startTime.toISOString()
    ]);

    session = sessionResult.rows[0];
    console.log(`✓ Created session ${session.id}`);

    // Process pages in batches
    const batches = [];
    for (let i = 0; i < totalPages; i += 10) {
      const pages = Array.from(
        { length: Math.min(10, totalPages - i) },
        (_, index) => i + index
      );
      batches.push(pages);
    }

    for (const batch of batches) {
      const success = await processBatch(batch, session.id, totalPages, startTime.toISOString());
      if (!success) {
        throw new Error('Failed to process batch');
      }
    }

    // Mark stale items as sold
    await markSoldItems(startTime.toISOString());

    // Complete session
    const endTime = new Date();
    await query(`
      UPDATE scraping_sessions
      SET status = 'completed',
          completed_at = $1,
          duration_ms = $2,
          processed_pages = $3,
          progress_percentage = 100
      WHERE id = $4
    `, [
      endTime.toISOString(),
      endTime - startTime,
      totalPages,
      session.id
    ]);

    console.log(`✅ Session ${session.id} completed successfully`);

    isScrapingInProgress = false;
    return { success: true, sessionId: session.id, totalItems, totalPages };

  } catch (error) {
    console.error(`❌ Scraping error:`, error);

    if (session?.id) {
      const endTime = new Date();
      await query(`
        UPDATE scraping_sessions
        SET status = 'failed',
            completed_at = $1,
            duration_ms = $2,
            error = $3
        WHERE id = $4
      `, [
        endTime.toISOString(),
        endTime - startTime,
        error.message,
        session.id
      ]);
    }

    isScrapingInProgress = false;
    return { success: false, error: error.message };
  }
}

export async function updateScraperConfig(newConfig) {
  try {
    if (!newConfig || typeof newConfig !== 'object') {
      throw new Error('Invalid configuration object');
    }

    if (!newConfig.query || typeof newConfig.query !== 'string') {
      throw new Error('Search query must be a non-empty string');
    }

    const queryParam = newConfig.query.trim();
    if (queryParam === '') {
      throw new Error('Search query cannot be empty');
    }

    const itemsPerPage = parseInt(newConfig.itemsPerPage);
    if (isNaN(itemsPerPage) || itemsPerPage < 1 || itemsPerPage > 100) {
      throw new Error('Items per page must be between 1 and 100');
    }

    SCRAPER_CONFIG.searchParams.q = queryParam;
    SCRAPER_CONFIG.pagination.itemsPerPage = itemsPerPage;

    return {
      success: true,
      config: {
        query: SCRAPER_CONFIG.searchParams.q,
        itemsPerPage: SCRAPER_CONFIG.pagination.itemsPerPage
      }
    };
  } catch (error) {
    console.error('Config update error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export function getScrapingStatus() {
  return {
    isRunning: isScrapingInProgress
  };
}
