

CREATE DATABASE IF NOT EXISTS artisoul
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE artisoul;

-- ---------------------------------------------------
-- 1. USERS
-- Both artisans and customers live here, split by role.
-- ---------------------------------------------------
CREATE TABLE Users (
    user_id      INT AUTO_INCREMENT PRIMARY KEY,
    role         ENUM('artisan', 'customer') NOT NULL,
    name         VARCHAR(100) NOT NULL,
    phone        VARCHAR(15) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,       -- store a bcrypt hash, never plaintext
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- ---------------------------------------------------
-- 2. SHOPS
-- One artisan -> one shop (extend to 1:many later if needed).
-- lat/long power the 5km "Nearby Product Discovery" feature.
-- ---------------------------------------------------
CREATE TABLE Shops (
    shop_id      INT AUTO_INCREMENT PRIMARY KEY,
    artisan_id   INT NOT NULL,
    shop_name    VARCHAR(150) NOT NULL,
    latitude     DECIMAL(10, 8) NOT NULL,     -- e.g. 18.52043000
    longitude    DECIMAL(11, 8) NOT NULL,     -- e.g. 73.85674000
    address      VARCHAR(255),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (artisan_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_shops_location (latitude, longitude)
) ENGINE=InnoDB;

-- ---------------------------------------------------
-- 3. PRODUCTS
-- Belongs to a shop. Category kept as VARCHAR for MVP
-- speed — normalize into a Categories table post-MVP if needed.
-- ---------------------------------------------------
CREATE TABLE Products (
    product_id   INT AUTO_INCREMENT PRIMARY KEY,
    shop_id      INT NOT NULL,
    name         VARCHAR(150) NOT NULL,
    price        DECIMAL(10, 2) NOT NULL,
    category     VARCHAR(100),
    image_url    VARCHAR(500),
    description  TEXT,
    stock_status ENUM('in_stock', 'out_of_stock') DEFAULT 'in_stock',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (shop_id) REFERENCES Shops(shop_id) ON DELETE CASCADE,
    INDEX idx_products_shop (shop_id),
    INDEX idx_products_category (category)
) ENGINE=InnoDB;


-- ---------------------------------------------------
-- 4. ORDERS
-- Links a customer to a product purchase.
-- ---------------------------------------------------
CREATE TABLE Orders (
    order_id          INT AUTO_INCREMENT PRIMARY KEY,
    customer_id       INT NOT NULL,
    product_id        INT NOT NULL,
    shop_id           INT NOT NULL,
    quantity          INT NOT NULL DEFAULT 1,
    price_at_purchase DECIMAL(10, 2) NOT NULL,
    status            ENUM('Pending', 'Delivered', 'Cancelled') DEFAULT 'Pending',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (shop_id) REFERENCES Shops(shop_id) ON DELETE CASCADE,
    INDEX idx_orders_customer (customer_id),
    INDEX idx_orders_status (status),
    INDEX idx_orders_shop (shop_id)
) ENGINE=InnoDB;

-- =====================================================
-- Sanity check: confirm all 4 tables exist
-- =====================================================
SHOW TABLES;

-- =====================================================
-- BONUS: sample data + the 5km "Nearby Discovery" query
-- Uncomment to try it after tables are created.
-- =====================================================

-- INSERT INTO Users (role, name, phone, password) VALUES
--   ('artisan', 'Meera Kulkarni', '9876543210', '$2b$10$hashedpasswordhere'),
--   ('customer', 'Rohan Sharma', '9123456780', '$2b$10$hashedpasswordhere');

-- INSERT INTO Shops (artisan_id, shop_name, latitude, longitude, address) VALUES
--   (1, 'Meera\'s Handloom Studio', 18.5204300, 73.8567400, 'FC Road, Pune');

-- INSERT INTO Products (shop_id, name, price, category, stock_status) VALUES
--   (1, 'Handwoven Cotton Saree', 2499.00, 'Textiles', 'in_stock');

-- Haversine formula: find shops within 5 km of a given (lat, long),
-- e.g. a customer at 18.5300, 73.8500.
-- SELECT
--     shop_id,
--     shop_name,
--     ( 6371 * ACOS(
--         COS(RADIANS(18.5300)) * COS(RADIANS(latitude)) *
--         COS(RADIANS(longitude) - RADIANS(73.8500)) +
--         SIN(RADIANS(18.5300)) * SIN(RADIANS(latitude))
--     ) ) AS distance_km
-- FROM Shops
-- HAVING distance_km <= 5
-- ORDER BY distance_km ASC;
