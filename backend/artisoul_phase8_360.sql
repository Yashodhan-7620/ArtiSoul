-- ArtiSoul Phase 8 — per-product 360° view
USE artisoul;

ALTER TABLE Products
  ADD COLUMN view360_enabled TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS Product360 (
  product_id INT NOT NULL,
  angle      ENUM('front','right','back','left','top','bottom') NOT NULL,
  url        VARCHAR(500) NOT NULL,
  PRIMARY KEY (product_id, angle),
  FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE
) ENGINE=InnoDB;
