const { pool } = require('../config/db');

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
  return r.affectedRows === 1;
}

async function releaseStock(productId, qty) {
  await pool.query(
    "UPDATE Products SET stock_quantity = stock_quantity + ?, stock_status = 'in_stock' WHERE product_id = ?",
    [qty, productId]
  );
}

module.exports = { reserveStock, releaseStock };
