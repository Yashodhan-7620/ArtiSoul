-- ArtiSoul Phase 12 - buyer reviews on purchases.
-- One review per order, written once by the buyer and never edited:
-- the API has no update or delete route for reviews.
USE artisoul;

CREATE TABLE IF NOT EXISTS Reviews (
  review_id   INT NOT NULL AUTO_INCREMENT,
  order_id    INT NOT NULL,
  customer_id INT NOT NULL,
  product_id  INT NOT NULL,
  rating      TINYINT NOT NULL,
  comment     TEXT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id),
  UNIQUE KEY one_review_per_order (order_id),
  CHECK (rating BETWEEN 1 AND 5),
  FOREIGN KEY (order_id)    REFERENCES Orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES Users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)  REFERENCES Products(product_id) ON DELETE CASCADE
) ENGINE=InnoDB;
