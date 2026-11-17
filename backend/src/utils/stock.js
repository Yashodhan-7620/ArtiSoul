const { pool } = require('../config/db');
const { notify } = require('./notify');

// At or below this many units, the artisan and interested buyers are alerted.
const LOW_STOCK = 3;

// Atomically takes `qty` units; returns false when there isn't enough stock.
// stock_status is assigned first so it is computed from the pre-update quantity.
async function reserveStock(productId, qty) {
  const [r] = await pool.query(
    `UPDATE Products
        SET stock_status = IF(stock_quantity - ? <= 0, 'out_of_stock', 'in_stock'),
            stock_quantity = stock_quantity - ?
      WHERE product_id = ? AND stock_quantity >= ?`,
    [qty, qty, productId, qty]
  );
  if (r.affectedRows !== 1) return false;
  await alertLowStock(productId);
  return true;
}

async function releaseStock(productId, qty) {
  await pool.query(
    "UPDATE Products SET stock_quantity = stock_quantity + ?, stock_status = 'in_stock' WHERE product_id = ?",
    [qty, productId]
  );
}

// Low-stock alerts to both sides:
// - the artisan, so they can restock;
// - buyers who have the piece in their cart or a wishlist, so they don't miss
//   it (at most one alert of each kind per buyer per product per day).
async function alertLowStock(productId) {
  try {
    const [[p]] = await pool.query(
      `SELECT p.product_id, p.name, p.stock_quantity, s.artisan_id
       FROM Products p JOIN Shops s ON s.shop_id = p.shop_id WHERE p.product_id = ?`,
      [productId]
    );
    if (!p || p.stock_quantity > LOW_STOCK) return;

    const soldOut = p.stock_quantity <= 0;
    const data = { product_id: p.product_id, product_name: p.name, left: p.stock_quantity };
    const link = `/product/${p.product_id}`;

    await notify(p.artisan_id, soldOut ? 'sold_out' : 'low_stock', data, '/artisan');

    const buyerType = soldOut ? 'sold_out_buyer' : 'low_stock_buyer';
    await pool.query(
      `INSERT INTO Notifications (user_id, type, data, link)
       SELECT b.user_id, ?, ?, ? FROM (
         SELECT user_id FROM CartItems WHERE product_id = ?
         UNION
         SELECT w.user_id FROM WishlistItems wi JOIN Wishlists w ON w.wishlist_id = wi.wishlist_id
         WHERE wi.product_id = ?
       ) b
       WHERE b.user_id <> ?
         AND NOT EXISTS (
           SELECT 1 FROM Notifications n
           WHERE n.user_id = b.user_id AND n.type = ?
             AND JSON_EXTRACT(n.data, '$.product_id') = ?
             AND n.created_at > (UTC_TIMESTAMP() - INTERVAL 1 DAY))`,
      [buyerType, JSON.stringify(data), link, p.product_id, p.product_id, p.artisan_id, buyerType, p.product_id]
    );
  } catch (err) {
    console.error('low-stock alert failed:', err.message);
  }
}

module.exports = { reserveStock, releaseStock, alertLowStock, LOW_STOCK };
