-- ArtiSoul Phase 14 - cash-on-delivery payment confirmation.
-- After a COD order is delivered, the buyer confirms "I paid the cash" and
-- the artisan confirms "I received the cash". When both have confirmed, the
-- API sets payment_status = 'Paid'.
USE artisoul;

ALTER TABLE Orders
  ADD COLUMN cod_buyer_confirmed_at   DATETIME NULL,
  ADD COLUMN cod_artisan_confirmed_at DATETIME NULL;
