-- ArtiSoul Phase 6 — checkout & payments (COD / UPI via Razorpay)
USE artisoul;

ALTER TABLE Orders
  ADD COLUMN payment_method      ENUM('COD','UPI') NOT NULL DEFAULT 'COD',
  ADD COLUMN payment_status      ENUM('Pending','Paid','Failed') NOT NULL DEFAULT 'Pending',
  ADD COLUMN delivery_name       VARCHAR(120) NULL,
  ADD COLUMN delivery_phone      VARCHAR(20)  NULL,
  ADD COLUMN delivery_address    VARCHAR(500) NULL,
  ADD COLUMN razorpay_order_id   VARCHAR(64)  NULL,
  ADD COLUMN razorpay_payment_id VARCHAR(64)  NULL;
