-- ArtiSoul Phase 11 - artisans accept orders and livestream the making of
-- an order privately to the customer who bought it.
USE artisoul;

-- New order state between Pending and Delivered.
ALTER TABLE Orders
  MODIFY COLUMN status ENUM('Pending','Accepted','Delivered','Cancelled') NOT NULL DEFAULT 'Pending';

-- One private stream per order. Video goes peer-to-peer over WebRTC; this
-- table only carries the connection handshake (SDP offer/answer) between the
-- artisan and that order's customer. `version` increases every time the
-- artisan (re)starts or the viewer rejoins, so stale answers are ignored.
CREATE TABLE IF NOT EXISTS LiveStreams (
  order_id     INT NOT NULL,
  artisan_id   INT NOT NULL,
  customer_id  INT NOT NULL,
  status       ENUM('live','ended') NOT NULL DEFAULT 'live',
  version      INT NOT NULL DEFAULT 1,
  offer        MEDIUMTEXT NULL,
  answer       MEDIUMTEXT NULL,
  started_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  FOREIGN KEY (order_id)    REFERENCES Orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (artisan_id)  REFERENCES Users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
