-- ArtiSoul Phase 10 - stock quantity (existing in-stock items start at 10)
USE artisoul;
ALTER TABLE Products ADD COLUMN stock_quantity INT NOT NULL DEFAULT 0;
UPDATE Products SET stock_quantity = 10 WHERE stock_status = 'in_stock';
