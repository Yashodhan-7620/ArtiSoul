const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { audit } = require('../utils/audit');

const MAX_PER_ITEM = 20;
const MAX_LINES = 30;

async function readCart(userId) {
  const [items] = await pool.query(
    `SELECT c.product_id, c.quantity, c.added_at, p.name, p.price, p.image_url, p.stock_quantity,
            p.stock_status, p.category, s.shop_name
     FROM CartItems c
     JOIN Products p ON p.product_id = c.product_id
     JOIN Shops s ON s.shop_id = p.shop_id
     WHERE c.user_id = ? ORDER BY c.added_at, c.product_id`,
    [userId]
  );
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  return { items, total, count };
}

// GET /api/cart
const getCart = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await readCart(req.user.user_id) });
});

async function loadProduct(productId) {
  const [[p]] = await pool.query(
    'SELECT product_id, name, stock_quantity, stock_status FROM Products WHERE product_id = ?',
    [productId]
  );
  return p;
}

// POST /api/cart   Body: { product_id, quantity? }  - adds to what's there.
const addToCart = asyncHandler(async (req, res) => {
  const product = await loadProduct(req.body.product_id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  if (product.stock_status === 'out_of_stock' || product.stock_quantity < 1) {
    return res.status(409).json({ success: false, message: 'This piece is sold out' });
  }
  const add = Math.max(1, Math.min(parseInt(req.body.quantity, 10) || 1, MAX_PER_ITEM));

  const [[existing]] = await pool.query('SELECT quantity FROM CartItems WHERE user_id = ? AND product_id = ?', [
    req.user.user_id,
    product.product_id,
  ]);
  if (!existing) {
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM CartItems WHERE user_id = ?', [req.user.user_id]);
    if (n >= MAX_LINES) return res.status(409).json({ success: false, message: 'Your cart is full' });
  }
  const quantity = Math.min((existing?.quantity || 0) + add, MAX_PER_ITEM, product.stock_quantity);

  await pool.query(
    `INSERT INTO CartItems (user_id, product_id, quantity) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
    [req.user.user_id, product.product_id, quantity]
  );
  await audit(req, 'cart.add', { entity: 'product', entityId: product.product_id, details: { quantity } });
  res.status(201).json({ success: true, data: await readCart(req.user.user_id) });
});

// PUT /api/cart/:productId   Body: { quantity }  - 0 removes the item.
const updateCartItem = asyncHandler(async (req, res) => {
  const quantity = parseInt(req.body.quantity, 10);
  if (!Number.isInteger(quantity) || quantity < 0) {
    return res.status(400).json({ success: false, message: 'quantity must be 0 or more' });
  }
  if (quantity === 0) {
    await pool.query('DELETE FROM CartItems WHERE user_id = ? AND product_id = ?', [req.user.user_id, req.params.productId]);
    return res.json({ success: true, data: await readCart(req.user.user_id) });
  }
  const product = await loadProduct(req.params.productId);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  if (quantity > Math.min(MAX_PER_ITEM, product.stock_quantity)) {
    return res.status(409).json({ success: false, message: `Only ${product.stock_quantity} available` });
  }
  const [r] = await pool.query('UPDATE CartItems SET quantity = ? WHERE user_id = ? AND product_id = ?', [
    quantity,
    req.user.user_id,
    product.product_id,
  ]);
  if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Not in your cart' });
  res.json({ success: true, data: await readCart(req.user.user_id) });
});

// DELETE /api/cart/:productId
const removeCartItem = asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM CartItems WHERE user_id = ? AND product_id = ?', [req.user.user_id, req.params.productId]);
  res.json({ success: true, data: await readCart(req.user.user_id) });
});

module.exports = { getCart, addToCart, updateCartItem, removeCartItem };
