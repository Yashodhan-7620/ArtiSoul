-- ArtiSoul Phase 7 — extra product photos / short videos for the preview gallery
USE artisoul;

CREATE TABLE IF NOT EXISTS ProductMedia (
  media_id    INT          NOT NULL AUTO_INCREMENT,
  product_id  INT          NOT NULL,
  media_type  ENUM('image','video') NOT NULL,
  url         VARCHAR(500) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (media_id),
  FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE
) ENGINE=InnoDB;
