const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/orders
// Auth: customer only.
// Body: { product_id, quantity? }
// Creates a Pending order and snapshots the price.
const createOrder = asyncHandler(async (req, res) => {
  const customer_id = req.user.user_id;
  const { product_id, quantity = 1 } = req.body;

  if (!product_id) {
    return res.status(400).json({ success: false, message: 'product_id is required' });
  }

  const [[product]] = await pool.query(
    'SELECT product_id, shop_id, price, stock_status FROM Products WHERE product_id = ?',
    [product_id]
  );

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  if (product.stock_status === 'out_of_stock') {
    return res.status(409).json({ success: false, message: 'Product is out of stock' });
  }

  const [result] = await pool.query(
    `INSERT INTO Orders (customer_id, product_id, shop_id, quantity, price_at_purchase, status)
     VALUES (?, ?, ?, ?, ?, 'Pending')`,
    [customer_id, product.product_id, product.shop_id, quantity, product.price]
  );

  const [[order]] = await pool.query('SELECT * FROM Orders WHERE order_id = ?', [result.insertId]);

  res.status(201).json({ success: true, message: 'Order placed successfully', data: order });
});

// GET /api/orders/mine
// Auth: customer only. Returns the calling customer's purchase history.
const getMyOrders = asyncHandler(async (req, res) => {
  const [orders] = await pool.query(
    `SELECT o.*, p.name AS product_name, p.image_url, s.shop_name
     FROM Orders o
     JOIN Products p ON p.product_id = o.product_id
     JOIN Shops    s ON s.shop_id    = o.shop_id
     WHERE o.customer_id = ?
     ORDER BY o.created_at DESC`,
    [req.user.user_id]
  );
  res.json({ success: true, count: orders.length, data: orders });
});

// GET /api/orders/shop
// Auth: artisan only. Returns all incoming orders for the artisan's shop(s).
const getShopOrders = asyncHandler(async (req, res) => {
  const [shops] = await pool.query(
    'SELECT shop_id FROM Shops WHERE artisan_id = ?',
    [req.user.user_id]
  );

  if (shops.length === 0) {
    return res.json({ success: true, count: 0, data: [] });
  }

  const shopIds = shops.map((s) => s.shop_id);

  const [orders] = await pool.query(
    `SELECT o.*, p.name AS product_name, u.name AS customer_name, u.phone AS customer_phone
     FROM Orders o
     JOIN Products p ON p.product_id = o.product_id
     JOIN Users    u ON u.user_id    = o.customer_id
     WHERE o.shop_id IN (?)
     ORDER BY o.created_at DESC`,
    [shopIds]
  );
  res.json({ success: true, count: orders.length, data: orders });
});

// PATCH /api/orders/:id/status
// Auth: artisan only. Artisan can mark their shop's orders Delivered or Cancelled.
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!['Pending', 'Delivered', 'Cancelled'].includes(status)) {
    return res.status(400).json({ success: false, message: "status must be 'Pending', 'Delivered' or 'Cancelled'" });
  }

  // Verify the order belongs to a shop owned by this artisan
  const [[order]] = await pool.query(
    `SELECT o.order_id FROM Orders o
     JOIN Shops s ON s.shop_id = o.shop_id
     WHERE o.order_id = ? AND s.artisan_id = ?`,
    [req.params.id, req.user.user_id]
  );

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found or not yours' });
  }

  await pool.query('UPDATE Orders SET status = ? WHERE order_id = ?', [status, req.params.id]);
  res.json({ success: true, data: { order_id: order.order_id, status } });
});

module.exports = { createOrder, getMyOrders, getShopOrders, updateOrderStatus };
