-- ArtiSoul Phase 5 - customer/artisan chat migration
USE artisoul;

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