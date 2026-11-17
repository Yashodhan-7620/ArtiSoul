-- ArtiSoul Phase 13 - order timeline, notifications, scheduled livestreams,
-- wishlists (max 2 per user, enforced by the API), cart, shop pictures,
-- admin role + account suspension, and the activity (audit) log.
USE artisoul;

-- Users: admin role and suspension.
ALTER TABLE Users
  MODIFY COLUMN role ENUM('artisan','customer','admin') NOT NULL DEFAULT 'customer',
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

-- Shops: a picture of the shop (set once, like the other shop details).
ALTER TABLE Shops ADD COLUMN image_url VARCHAR(500) NULL;

-- Orders: a Shipped step, a tentative livestream time, and a reference that
-- groups the orders created by one cart checkout (one payment).
ALTER TABLE Orders
  MODIFY COLUMN status ENUM('Pending','Accepted','Shipped','Delivered','Cancelled') NOT NULL DEFAULT 'Pending',
  ADD COLUMN scheduled_live_at DATETIME NULL,
  ADD COLUMN checkout_ref VARCHAR(32) NULL,
  ADD INDEX idx_orders_checkout_ref (checkout_ref);

-- Every step an order goes through, for the timeline.
CREATE TABLE IF NOT EXISTS OrderEvents (
  event_id   INT NOT NULL AUTO_INCREMENT,
  order_id   INT NOT NULL,
  event      VARCHAR(30) NOT NULL,   -- Placed, Paid, Accepted, LiveScheduled, LiveStarted, Shipped, Delivered, Cancelled
  meta       JSON NULL,
  actor_id   INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  INDEX idx_order_events_order (order_id, created_at),
  FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- In-app notifications. The app renders the text from `type` + `data`, so
-- it appears in the reader's language (English / Hindi / Marathi).
CREATE TABLE IF NOT EXISTS Notifications (
  notification_id INT NOT NULL AUTO_INCREMENT,
  user_id    INT NOT NULL,
  type       VARCHAR(40) NOT NULL,
  data       JSON NULL,
  link       VARCHAR(255) NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  INDEX idx_notifications_user (user_id, is_read, created_at),
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Named wishlists ("sections"); the API allows at most two per user.
CREATE TABLE IF NOT EXISTS Wishlists (
  wishlist_id INT NOT NULL AUTO_INCREMENT,
  user_id     INT NOT NULL,
  name        VARCHAR(40) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (wishlist_id),
  INDEX idx_wishlists_user (user_id),
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS WishlistItems (
  wishlist_id INT NOT NULL,
  product_id  INT NOT NULL,
  added_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (wishlist_id, product_id),
  FOREIGN KEY (wishlist_id) REFERENCES Wishlists(wishlist_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)  REFERENCES Products(product_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CartItems (
  user_id    INT NOT NULL,
  product_id INT NOT NULL,
  quantity   INT NOT NULL DEFAULT 1,
  added_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, product_id),
  FOREIGN KEY (user_id)    REFERENCES Users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Activity log for the admin panel. Privacy by design: no passwords, no chat
-- text, no addresses; IPs and login phone numbers are stored only as keyed
-- hashes (enough to spot abuse, not enough to identify anyone). No foreign
-- keys, so the record survives if a user or product is deleted.
CREATE TABLE IF NOT EXISTS AuditLog (
  log_id       BIGINT NOT NULL AUTO_INCREMENT,
  actor_id     INT NULL,
  actor_role   VARCHAR(20) NULL,
  action       VARCHAR(60) NOT NULL,
  entity       VARCHAR(40) NULL,
  entity_id    INT NULL,
  subject_hash CHAR(16) NULL,
  ip_hash      CHAR(16) NULL,
  details      JSON NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_action (action, created_at),
  INDEX idx_audit_subject (subject_hash, action, created_at),
  INDEX idx_audit_ip (ip_hash, action, created_at),
  INDEX idx_audit_actor (actor_id, created_at)
) ENGINE=InnoDB;

-- Timeline history for orders that already exist.
INSERT INTO OrderEvents (order_id, event, created_at)
  SELECT order_id, 'Placed', created_at FROM Orders;
INSERT INTO OrderEvents (order_id, event, created_at)
  SELECT order_id, 'Paid', created_at FROM Orders WHERE payment_status = 'Paid';
INSERT INTO OrderEvents (order_id, event, created_at)
  SELECT order_id, status, created_at FROM Orders WHERE status <> 'Pending';
