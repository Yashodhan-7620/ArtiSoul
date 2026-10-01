-- ArtiSoul Phase 1 — MySQL schema
-- Run: mysql -u root -p < artisoul_schema.sql

CREATE DATABASE IF NOT EXISTS artisoul
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE artisoul;

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Users (
  user_id    INT               NOT NULL AUTO_INCREMENT,
  name       VARCHAR(120)     NOT NULL,
  phone      VARCHAR(20)      NOT NULL UNIQUE,
  password   VARCHAR(255)     NOT NULL,  -- bcrypt hash stored here
  role       ENUM('artisan','customer') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB;

-- ─── Shops ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Shops (
  shop_id    INT               NOT NULL AUTO_INCREMENT,
  artisan_id INT               NOT NULL,
  shop_name  VARCHAR(200)     NOT NULL,
  address    VARCHAR(500),
  latitude   DECIMAL(9,6)     NOT NULL,
  longitude  DECIMAL(9,6)     NOT NULL,
  created_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (shop_id),
  FOREIGN KEY (artisan_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Products ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Products (
  product_id   INT              NOT NULL AUTO_INCREMENT,
  shop_id      INT              NOT NULL,
  name         VARCHAR(200)    NOT NULL,
  description  TEXT,
  price        DECIMAL(10,2)   NOT NULL,
  category     VARCHAR(100),
  image_url    VARCHAR(500),
  stock_status ENUM('in_stock', 'out_of_stock') NOT NULL DEFAULT 'in_stock',
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  FOREIGN KEY (shop_id) REFERENCES Shops(shop_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Conversations are scoped to one shop and one customer. Messages are kept
-- separately so either participant can continue the same conversation.
CREATE TABLE IF NOT EXISTS ChatConversations (
  conversation_id INT NOT NULL AUTO_INCREMENT,
  shop_id         INT NOT NULL,
  customer_id     INT NOT NULL,
  artisan_id      INT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id),
  UNIQUE KEY one_customer_per_shop (shop_id, customer_id),
  FOREIGN KEY (shop_id) REFERENCES Shops(shop_id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES Users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (artisan_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ChatMessages (
  message_id      INT NOT NULL AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  sender_id       INT NOT NULL,
  body            TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id),
  FOREIGN KEY (conversation_id) REFERENCES ChatConversations(conversation_id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
