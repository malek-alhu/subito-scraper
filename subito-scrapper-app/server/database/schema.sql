-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS deal_alerts CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS scraped_items CASCADE;
DROP TABLE IF EXISTS scraping_sessions CASCADE;

-- Scraping sessions table
CREATE TABLE scraping_sessions (
    id SERIAL PRIMARY KEY,
    search_query VARCHAR(255) NOT NULL,
    total_items INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0,
    processed_pages INTEGER DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'in_progress',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_processed_at TIMESTAMP,
    duration_ms BIGINT DEFAULT 0,
    error TEXT
);

-- Scraped items table
CREATE TABLE scraped_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES scraping_sessions(id) ON DELETE CASCADE,
    item_id VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Extracted fields for easy querying
    title TEXT,
    price DECIMAL(10,2),
    original_price DECIMAL(10,2),
    category VARCHAR(255),
    location VARCHAR(255),
    seller_name VARCHAR(255),
    seller_id VARCHAR(255),
    image_url TEXT,
    listing_url TEXT,
    posted_at TIMESTAMP,

    -- Unique constraint
    UNIQUE(item_id, session_id)
);

-- Price history table for tracking price changes
CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    previous_price DECIMAL(10,2),
    price_change DECIMAL(10,2),
    price_change_percentage DECIMAL(5,2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_id INTEGER REFERENCES scraping_sessions(id) ON DELETE CASCADE,

    -- Index for fast lookups
    CONSTRAINT fk_scraped_item FOREIGN KEY (item_id) REFERENCES scraped_items(item_id) ON DELETE CASCADE
);

-- Deal alerts table for tracking good deals
CREATE TABLE deal_alerts (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- 'price_drop', 'below_average', 'great_deal', 'new_listing'
    deal_score DECIMAL(5,2), -- Score from 0-100 indicating how good the deal is
    price DECIMAL(10,2),
    average_price DECIMAL(10,2),
    price_difference DECIMAL(10,2),
    price_difference_percentage DECIMAL(5,2),
    title TEXT,
    listing_url TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_notified BOOLEAN DEFAULT FALSE,
    notified_at TIMESTAMP,
    is_dismissed BOOLEAN DEFAULT FALSE,

    CONSTRAINT fk_scraped_item_alert FOREIGN KEY (item_id) REFERENCES scraped_items(item_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_sessions_status ON scraping_sessions(status);
CREATE INDEX idx_sessions_created_at ON scraping_sessions(created_at DESC);
CREATE INDEX idx_sessions_search_query ON scraping_sessions(search_query);

CREATE INDEX idx_items_item_id ON scraped_items(item_id);
CREATE INDEX idx_items_session_id ON scraped_items(session_id);
CREATE INDEX idx_items_status ON scraped_items(status);
CREATE INDEX idx_items_price ON scraped_items(price);
CREATE INDEX idx_items_last_checked ON scraped_items(last_checked_at);
CREATE INDEX idx_items_created_at ON scraped_items(created_at DESC);
CREATE INDEX idx_items_category ON scraped_items(category);
CREATE INDEX idx_items_location ON scraped_items(location);
CREATE INDEX idx_items_data_gin ON scraped_items USING GIN(data);

CREATE INDEX idx_price_history_item_id ON price_history(item_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at DESC);
CREATE INDEX idx_price_history_session_id ON price_history(session_id);

CREATE INDEX idx_deal_alerts_item_id ON deal_alerts(item_id);
CREATE INDEX idx_deal_alerts_type ON deal_alerts(alert_type);
CREATE INDEX idx_deal_alerts_score ON deal_alerts(deal_score DESC);
CREATE INDEX idx_deal_alerts_created_at ON deal_alerts(created_at DESC);
CREATE INDEX idx_deal_alerts_notified ON deal_alerts(is_notified, created_at DESC);
CREATE INDEX idx_deal_alerts_dismissed ON deal_alerts(is_dismissed);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scraped_items_updated_at
    BEFORE UPDATE ON scraped_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate average price for a category/search term
CREATE OR REPLACE FUNCTION calculate_average_price(search_term VARCHAR, category_name VARCHAR DEFAULT NULL)
RETURNS DECIMAL AS $$
DECLARE
    avg_price DECIMAL;
BEGIN
    SELECT AVG(price) INTO avg_price
    FROM scraped_items
    WHERE status = 'active'
    AND price > 0
    AND (category_name IS NULL OR category = category_name)
    AND created_at > NOW() - INTERVAL '30 days';

    RETURN COALESCE(avg_price, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to detect price drops and create alerts
CREATE OR REPLACE FUNCTION detect_price_drops()
RETURNS TABLE(item_id VARCHAR, old_price DECIMAL, new_price DECIMAL, drop_percentage DECIMAL) AS $$
BEGIN
    RETURN QUERY
    WITH latest_prices AS (
        SELECT
            ph.item_id,
            ph.price as new_price,
            ph.previous_price as old_price,
            ph.price_change_percentage as drop_percentage,
            ph.recorded_at
        FROM price_history ph
        WHERE ph.price_change_percentage < -10  -- More than 10% drop
        AND ph.recorded_at > NOW() - INTERVAL '1 day'
    )
    SELECT
        lp.item_id,
        lp.old_price,
        lp.new_price,
        lp.drop_percentage
    FROM latest_prices lp;
END;
$$ LANGUAGE plpgsql;

-- View for active good deals
CREATE OR REPLACE VIEW active_good_deals AS
SELECT
    da.*,
    si.title,
    si.price,
    si.category,
    si.location,
    si.image_url,
    si.listing_url,
    si.data
FROM deal_alerts da
JOIN scraped_items si ON da.item_id = si.item_id
WHERE da.is_dismissed = FALSE
AND si.status = 'active'
ORDER BY da.deal_score DESC, da.created_at DESC;

-- View for recent price drops
CREATE OR REPLACE VIEW recent_price_drops AS
SELECT
    ph.*,
    si.title,
    si.category,
    si.location,
    si.image_url,
    si.listing_url,
    si.status as item_status
FROM price_history ph
JOIN scraped_items si ON ph.item_id = si.item_id
WHERE ph.price_change_percentage < 0
AND ph.recorded_at > NOW() - INTERVAL '7 days'
ORDER BY ph.recorded_at DESC;

-- View for session statistics
CREATE OR REPLACE VIEW session_stats AS
SELECT
    ss.id,
    ss.search_query,
    ss.status,
    ss.created_at,
    ss.duration_ms,
    ss.total_items,
    ss.total_pages,
    COUNT(DISTINCT si.id) as items_scraped,
    COUNT(DISTINCT CASE WHEN si.status = 'active' THEN si.id END) as active_items,
    COUNT(DISTINCT CASE WHEN si.status = 'sold' THEN si.id END) as sold_items,
    AVG(si.price) as avg_price,
    MIN(si.price) as min_price,
    MAX(si.price) as max_price
FROM scraping_sessions ss
LEFT JOIN scraped_items si ON ss.id = si.session_id
GROUP BY ss.id, ss.search_query, ss.status, ss.created_at, ss.duration_ms, ss.total_items, ss.total_pages;
