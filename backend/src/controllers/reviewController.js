const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/orders/:id/review
// Auth: customer only. Body: { rating: 1-5, comment? }
// A buyer can review each delivered order exactly once. Reviews are final:
// there is deliberately no route to edit or delete one.
const createReview = asyncHandler(async (req, res) => {
  const rating = Number(req.body.rating);
  const comment = String(req.body.comment ?? '').trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be a whole number from 1 to 5' });
  }
  if (comment.length > 1000) {
    return res.status(400).json({ success: false, message: 'Review must be 1000 characters or fewer' });
  }

  const [[order]] = await pool.query(
    'SELECT order_id, product_id, status FROM Orders WHERE order_id = ? AND customer_id = ?',
    [req.params.id, req.user.user_id]
  );
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.status !== 'Delivered') {
    return res.status(409).json({ success: false, message: 'You can review an order once it has been delivered' });
  }

  try {
    await pool.query(
      'INSERT INTO Reviews (order_id, customer_id, product_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
      [order.order_id, req.user.user_id, order.product_id, rating, comment || null]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'You have already reviewed this order. Reviews cannot be changed.' });
    }
    throw err;
  }

  const [[review]] = await pool.query(
    'SELECT rating, comment, created_at FROM Reviews WHERE order_id = ?',
    [order.order_id]
  );
  res.status(201).json({ success: true, message: 'Review submitted', data: review });
});

module.exports = { createReview };
