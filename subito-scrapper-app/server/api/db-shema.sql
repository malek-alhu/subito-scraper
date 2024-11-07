-- Static/Reference Tables with Natural Keys

-- Regions table (static)
CREATE TABLE regions (
    region_id VARCHAR(10) PRIMARY KEY,      -- Natural key from API
    region_name VARCHAR(100) NOT NULL,      
    friendly_name VARCHAR(100),
    UNIQUE(region_name)                     -- Prevent duplicates by name
);

-- Cities table (static)
CREATE TABLE cities (
    city_id VARCHAR(10) PRIMARY KEY,        -- Natural key from API
    city_name VARCHAR(100) NOT NULL,        
    province_code CHAR(2),                  
    region_id VARCHAR(10),
    UNIQUE(city_name, region_id),           -- City names might repeat in different regions
    FOREIGN KEY (region_id) REFERENCES regions(region_id)
);

-- Towns table (static)
CREATE TABLE towns (
    town_id VARCHAR(10) PRIMARY KEY,        -- Natural key from API
    town_name VARCHAR(100) NOT NULL,        
    city_id VARCHAR(10),                    
    region_id VARCHAR(10),
    UNIQUE(town_name, city_id),             -- Town names might repeat in different cities
    FOREIGN KEY (city_id) REFERENCES cities(city_id),
    FOREIGN KEY (region_id) REFERENCES regions(region_id)
);

-- Categories table (static)
CREATE TABLE categories (
    category_id VARCHAR(10) PRIMARY KEY,    -- Natural key from API
    category_name VARCHAR(100) NOT NULL,    
    friendly_name VARCHAR(100),             
    macrocategory_id VARCHAR(10),          
    weight INT,
    UNIQUE(category_name)                   -- Prevent duplicates by name
);

-- Shipping carriers table (static)
CREATE TABLE shipping_carriers (
    carrier_key VARCHAR(50) PRIMARY KEY,    -- Using carrier_key as natural key instead of serial
    carrier_name VARCHAR(100) NOT NULL,
    UNIQUE(carrier_name)                    -- Prevent duplicates by name
);

-- Dynamic Tables with Change Tracking

-- Sellers table (dynamic but needs history)
CREATE TABLE sellers (
    seller_id VARCHAR(20) PRIMARY KEY,      -- Natural key from API
    name VARCHAR(100),                      
    is_company BOOLEAN DEFAULT false,       
    seller_type INT,
    first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true             -- Soft delete flag
);

-- Listings table (dynamic with daily updates)
CREATE TABLE listings (
    listing_id VARCHAR(50) PRIMARY KEY,     -- Using URN as natural key
    subject VARCHAR(200) NOT NULL,          
    body TEXT,                              
    price DECIMAL(10,2),                    
    condition_key VARCHAR(10),              
    condition_value VARCHAR(100),           
    type_key VARCHAR(10),                   
    type_value VARCHAR(50),                 
    created_at TIMESTAMP NOT NULL,          
    expires_at TIMESTAMP,                   
    category_id VARCHAR(10),                
    seller_id VARCHAR(20),                  
    town_id VARCHAR(10),                    
    is_shippable BOOLEAN DEFAULT false,     
    shipping_cost DECIMAL(6,2),             
    package_size VARCHAR(50),               
    first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true,            -- For soft deletes
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    FOREIGN KEY (seller_id) REFERENCES sellers(seller_id),
    FOREIGN KEY (town_id) REFERENCES towns(town_id)
);

-- Listing-Carrier junction table (dynamic)
CREATE TABLE listing_carriers (
    listing_id VARCHAR(50),
    carrier_key VARCHAR(50),                -- Changed from carrier_id to carrier_key
    PRIMARY KEY (listing_id, carrier_key),
    FOREIGN KEY (listing_id) REFERENCES listings(listing_id),
    FOREIGN KEY (carrier_key) REFERENCES shipping_carriers(carrier_key)
);

-- Indexes for performance
CREATE INDEX idx_listings_created_at ON listings(created_at);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_listings_town ON listings(town_id);
CREATE INDEX idx_listings_active ON listings(active);
CREATE INDEX idx_sellers_active ON sellers(active);

-- Trigger function to update last_updated_at
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers
CREATE TRIGGER update_seller_last_updated
    BEFORE UPDATE ON sellers
    FOR EACH ROW
    EXECUTE FUNCTION update_last_updated_column();

CREATE TRIGGER update_listing_last_updated
    BEFORE UPDATE ON listings
    FOR EACH ROW
    EXECUTE FUNCTION update_last_updated_column();