-- ArtiSoul Phase 4 — Orders table & schema patch migration
-- Run against the artisoul database in MySQL Workbench or mysql CLI:
-- USE artisoul; source artisoul_phase4_orders.sql

USE artisoul;

-- Ensure stock_status column exists on Products table
SET @exist_stock := (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'artisoul' 
    AND TABLE_NAME = 'Products' 
    AND COLUMN_NAME = 'stock_status'
);
SET @sql_stock := IF(@exist_stock = 0, 
  'ALTER TABLE Products ADD COLUMN stock_status ENUM(\'in_stock\', \'out_of_stock\') NOT NULL DEFAULT \'in_stock\'', 
  'SELECT 1'
);
PREPARE stmt_stock FROM @sql_stock;
EXECUTE stmt_stock;
DEALLOCATE PREPARE stmt_stock;

-- Ensure Shops table uses artisan_id (rename owner_id if present)
SET @exist_owner := (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'artisoul' 
    AND TABLE_NAME = 'Shops' 
    AND COLUMN_NAME = 'owner_id'
);
SET @sql_owner := IF(@exist_owner > 0, 
  'ALTER TABLE Shops CHANGE COLUMN owner_id artisan_id INT UNSIGNED NOT NULL', 
  'SELECT 1'
);
PREPARE stmt_owner FROM @sql_owner;
EXECUTE stmt_owner;
DEALLOCATE PREPARE stmt_owner;

-- Create Orders Table
CREATE TABLE IF NOT EXISTS Orders (
  order_id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  customer_id        INT UNSIGNED    NOT NULL,
  product_id         INT UNSIGNED    NOT NULL,
  shop_id            INT UNSIGNED    NOT NULL,
  quantity           INT UNSIGNED    NOT NULL DEFAULT 1,
  -- Snapshot the price so later edits don't rewrite history
  price_at_purchase  DECIMAL(10,2)   NOT NULL,
  status             ENUM('Pending','Delivered','Cancelled') NOT NULL DEFAULT 'Pending',
  created_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (order_id),
  FOREIGN KEY (customer_id) REFERENCES Users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)  REFERENCES Products(product_id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id)     REFERENCES Shops(shop_id) ON DELETE CASCADE
) ENGINE=InnoDB;
