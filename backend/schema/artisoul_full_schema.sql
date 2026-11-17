-- ArtiSoul - complete database schema (all migrations up to phase 15).
-- Use this to create a fresh database, e.g. for CI or a new server:
--   mysql -u root -p -e "CREATE DATABASE artisoul CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
--   mysql -u root -p artisoul < backend/schema/artisoul_full_schema.sql
-- Generated from the live schema; the phaseN files remain the upgrade path.

SET FOREIGN_KEY_CHECKS = 0;


CREATE TABLE `AuditLog` (
  `log_id` bigint NOT NULL AUTO_INCREMENT,
  `actor_id` int DEFAULT NULL,
  `actor_role` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `subject_hash` char(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_hash` char(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_audit_created` (`created_at`),
  KEY `idx_audit_action` (`action`,`created_at`),
  KEY `idx_audit_subject` (`subject_hash`,`action`,`created_at`),
  KEY `idx_audit_ip` (`ip_hash`,`action`,`created_at`),
  KEY `idx_audit_actor` (`actor_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `CartItems` (
  `user_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `added_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`product_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `CartItems_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `Users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `CartItems_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `Products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `ChatConversations` (
  `conversation_id` int NOT NULL AUTO_INCREMENT,
  `shop_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `artisan_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`),
  UNIQUE KEY `one_customer_per_shop` (`shop_id`,`customer_id`),
  KEY `customer_id` (`customer_id`),
  KEY `artisan_id` (`artisan_id`),
  CONSTRAINT `chatconversations_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `Shops` (`shop_id`) ON DELETE CASCADE,
  CONSTRAINT `chatconversations_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `Users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `chatconversations_ibfk_3` FOREIGN KEY (`artisan_id`) REFERENCES `Users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `ChatMessages` (
  `message_id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  KEY `conversation_id` (`conversation_id`),
  KEY `sender_id` (`sender_id`),
  CONSTRAINT `chatmessages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `ChatConversations` (`conversation_id`) ON DELETE CASCADE,
  CONSTRAINT `chatmessages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `Users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `LiveStreams` (
  `order_id` int NOT NULL,
  `artisan_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `status` enum('live','ended') NOT NULL DEFAULT 'live',
  `version` int NOT NULL DEFAULT '1',
  `offer` mediumtext,
  `answer` mediumtext,
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`order_id`),
  KEY `artisan_id` (`artisan_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `livestreams_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `Orders` (`order_id`) ON DELETE CASCADE,
  CONSTRAINT `livestreams_ibfk_2` FOREIGN KEY (`artisan_id`) REFERENCES `Users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `livestreams_ibfk_3` FOREIGN KEY (`customer_id`) REFERENCES `Users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `Notifications` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` json DEFAULT NULL,
  `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `idx_notifications_user` (`user_id`,`is_read`,`created_at`),
  CONSTRAINT `Notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `Users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `OrderEvents` (
  `event_id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `event` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `meta` json DEFAULT NULL,
  `actor_id` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`),
  KEY `idx_order_events_order` (`order_id`,`created_at`),
  CONSTRAINT `OrderEvents_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `Orders` (`order_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Orders` (
  `order_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `product_id` int NOT NULL,
  `shop_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `price_at_purchase` decimal(10,2) NOT NULL,
  `status` enum('Pending','Accepted','Shipped','Delivered','Cancelled') NOT NULL DEFAULT 'Pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `payment_method` enum('COD','UPI') NOT NULL DEFAULT 'COD',
  `payment_status` enum('Pending','Paid','Failed') NOT NULL DEFAULT 'Pending',
  `delivery_name` varchar(120) DEFAULT NULL,
  `delivery_phone` varchar(20) DEFAULT NULL,
  `delivery_address` varchar(500) DEFAULT NULL,
  `razorpay_order_id` varchar(64) DEFAULT NULL,
  `razorpay_payment_id` varchar(64) DEFAULT NULL,
  `scheduled_live_at` datetime DEFAULT NULL,
  `checkout_ref` varchar(32) DEFAULT NULL,
  `cod_buyer_confirmed_at` datetime DEFAULT NULL,
  `cod_artisan_confirmed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`order_id`),
  KEY `customer_id` (`customer_id`),
  KEY `product_id` (`product_id`),
  KEY `shop_id` (`shop_id`),
  KEY `idx_orders_checkout_ref` (`checkout_ref`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `Users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `Products` (`product_id`) ON DELETE CASCADE,
  CONSTRAINT `orders_ibfk_3` FOREIGN KEY (`shop_id`) REFERENCES `Shops` (`shop_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `Product360` (
  `product_id` int NOT NULL,
  `angle` enum('front','right','back','left','top','bottom') NOT NULL,
  `url` varchar(500) NOT NULL,
  PRIMARY KEY (`product_id`,`angle`),
  CONSTRAINT `product360_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `Products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `ProductMedia` (
  `media_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `media_type` enum('image','video') NOT NULL,
  `url` varchar(500) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`media_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `productmedia_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `Products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `Products` (
  `product_id` int NOT NULL AUTO_INCREMENT,
  `shop_id` int NOT NULL,
  `name` varchar(150) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `description` text,
  `stock_status` enum('in_stock','out_of_stock') DEFAULT 'in_stock',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `view360_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `model_url` varchar(500) DEFAULT NULL,
  `stock_quantity` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`product_id`),
  KEY `idx_products_shop` (`shop_id`),
  KEY `idx_products_category` (`category`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`shop_id`) REFERENCES `Shops` (`shop_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `Reviews` (
  `review_id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `product_id` int NOT NULL,
  `rating` tinyint NOT NULL,
  `comment` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`review_id`),
  UNIQUE KEY `one_review_per_order` (`order_id`),
  KEY `customer_id` (`customer_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `Orders` (`order_id`) ON DELETE CASCADE,
  CONSTRAINT `reviews_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `Users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `reviews_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `Products` (`product_id`) ON DELETE CASCADE,
  CONSTRAINT `reviews_chk_1` CHECK ((`rating` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `Shops` (
  `shop_id` int NOT NULL AUTO_INCREMENT,
  `artisan_id` int NOT NULL,
  `shop_name` varchar(150) NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `image_url` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`shop_id`),
  KEY `artisan_id` (`artisan_id`),
  KEY `idx_shops_location` (`latitude`,`longitude`),
  CONSTRAINT `shops_ibfk_1` FOREIGN KEY (`artisan_id`) REFERENCES `Users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `Users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `role` enum('artisan','customer','admin') NOT NULL DEFAULT 'customer',
  `name` varchar(100) NOT NULL,
  `phone` varchar(15) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `phone` (`phone`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `WishlistItems` (
  `wishlist_id` int NOT NULL,
  `product_id` int NOT NULL,
  `added_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`wishlist_id`,`product_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `WishlistItems_ibfk_1` FOREIGN KEY (`wishlist_id`) REFERENCES `Wishlists` (`wishlist_id`) ON DELETE CASCADE,
  CONSTRAINT `WishlistItems_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `Products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Wishlists` (
  `wishlist_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`wishlist_id`),
  KEY `idx_wishlists_user` (`user_id`),
  CONSTRAINT `Wishlists_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `Users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- Phase 15: events (venues and slots are seeded by artisoul_phase15_events.sql)
CREATE TABLE IF NOT EXISTS Venues (
  venue_id    INT NOT NULL AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  area        VARCHAR(80)  NOT NULL,
  city        VARCHAR(60)  NOT NULL DEFAULT 'Pune',
  latitude    DECIMAL(9,6) NOT NULL,
  longitude   DECIMAL(9,6) NOT NULL,
  capacity_stalls INT NOT NULL,
  description VARCHAR(300) NULL,
  PRIMARY KEY (venue_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS VenueSlots (
  slot_id   INT NOT NULL AUTO_INCREMENT,
  venue_id  INT NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at   DATETIME NOT NULL,
  price     DECIMAL(10,2) NOT NULL,
  status    ENUM('available','booked') NOT NULL DEFAULT 'available',
  PRIMARY KEY (slot_id),
  INDEX idx_slots_venue (venue_id, starts_at),
  FOREIGN KEY (venue_id) REFERENCES Venues(venue_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- A "call" for artisans at one venue slot. open -> pending_approval (when at
-- least 30% of artisans said yes) -> approved (admin booked) / rejected.
CREATE TABLE IF NOT EXISTS Events (
  event_id    INT NOT NULL AUTO_INCREMENT,
  slot_id     INT NOT NULL,
  created_by  INT NOT NULL,
  title       VARCHAR(120) NOT NULL,
  description TEXT NULL,
  activities  SET('exhibit','sell','resale','popup_shop','meetup','inspire','workshop') NOT NULL,
  status      ENUM('open','pending_approval','approved','rejected','cancelled') NOT NULL DEFAULT 'open',
  decided_by  INT NULL,
  decision_note VARCHAR(300) NULL,
  decided_at  DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  INDEX idx_events_slot (slot_id),
  FOREIGN KEY (slot_id) REFERENCES VenueSlots(slot_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- One answer per artisan per event. A "yes" is a commitment and is final.
CREATE TABLE IF NOT EXISTS EventResponses (
  event_id     INT NOT NULL,
  artisan_id   INT NOT NULL,
  response     ENUM('yes','no') NOT NULL,
  activities   SET('exhibit','sell','resale','popup_shop','meetup','inspire','workshop') NULL,
  acknowledged TINYINT(1) NOT NULL DEFAULT 0,
  responded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, artisan_id),
  FOREIGN KEY (event_id) REFERENCES Events(event_id) ON DELETE CASCADE,
  FOREIGN KEY (artisan_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
