const crypto = require('crypto');
const Razorpay = require('razorpay');
const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const keyId = process.env.TEST_KEY_ID;
const keySecret = process.env.TEST_KEY_SECRET;
const razorpay = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;

// POST /api/orders/checkout
// Body: { product_id, quantity, payment_method: 'COD'|'UPI', name, phone, address }
// COD  -> order is created and confirmed immediately.
// UPI  -> order is created, a Razorpay order is opened and its details returned
//         so the client can launch Razorpay Checkout; confirm via /verify-payment.
const checkout = asyncHandler(async (req, res) => {
  const { product_id, payment_method, name, phone, address } = req.body;
  const quantity = Math.max(1, Math.min(parseInt(req.body.quantity, 10) || 1, 20));

  if (!product_id) return res.status(400).json({ success: false, message: 'product_id is required' });
  if (!['COD', 'UPI'].includes(payment_method)) {
    return res.status(400).json({ success: false, message: "payment_method must be 'COD' or 'UPI'" });
  }
  if (!name?.trim() || !/^[0-9+\-\s]{10,15}$/.test(phone || '') || !address?.trim()) {
    return res.status(400).json({ success: false, message: 'Valid name, phone and delivery address are required' });
  }

  const [[product]] = await pool.query(
    'SELECT product_id, shop_id, price, stock_status FROM Products WHERE product_id = ?',
    [product_id]
  );
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  if (product.stock_status === 'out_of_stock') {
    return res.status(409).json({ success: false, message: 'Product is out of stock' });
  }

  if (payment_method === 'UPI' && !razorpay) {
    return res.status(503).json({ success: false, message: 'Online payments are not configured' });
  }

  const [result] = await pool.query(
    `INSERT INTO Orders (customer_id, product_id, shop_id, quantity, price_at_purchase, status,
                         payment_method, payment_status, delivery_name, delivery_phone, delivery_address)
     VALUES (?, ?, ?, ?, ?, 'Pending', ?, 'Pending', ?, ?, ?)`,
    [req.user.user_id, product.product_id, product.shop_id, quantity, product.price,
     payment_method, name.trim(), phone.trim(), address.trim()]
  );
  const order_id = result.insertId;

  if (payment_method === 'COD') {
    return res.status(201).json({ success: true, message: 'Order placed', data: { order_id, payment_method } });
  }

  const amount = Math.round(product.price * quantity * 100); // paise
  let rzpOrder;
  try {
    rzpOrder = await razorpay.orders.create({ amount, currency: 'INR', receipt: `order_${order_id}` });
  } catch (err) {
    await pool.query('DELETE FROM Orders WHERE order_id = ?', [order_id]);
    return res.status(502).json({ success: false, message: 'Could not start the payment. Please try again.' });
  }
  await pool.query('UPDATE Orders SET razorpay_order_id = ? WHERE order_id = ?', [rzpOrder.id, order_id]);

  res.status(201).json({
    success: true,
    data: {
      order_id,
      payment_method,
      key_id: keyId,
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    },
  });
});

// POST /api/orders/verify-payment
// Body: { order_id, razorpay_payment_id, razorpay_signature }
const verifyPayment = asyncHandler(async (req, res) => {
  const { order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Missing payment details' });
  }

  const [[order]] = await pool.query(
    'SELECT order_id, razorpay_order_id FROM Orders WHERE order_id = ? AND customer_id = ? AND payment_method = \'UPI\'',
    [order_id, req.user.user_id]
  );
  if (!order || !order.razorpay_order_id) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${order.razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  const valid =
    expected.length === razorpay_signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));

  if (!valid) {
    await pool.query("UPDATE Orders SET payment_status = 'Failed' WHERE order_id = ?", [order_id]);
    return res.status(400).json({ success: false, message: 'Payment verification failed' });
  }

  await pool.query(
    "UPDATE Orders SET payment_status = 'Paid', razorpay_payment_id = ? WHERE order_id = ?",
    [razorpay_payment_id, order_id]
  );
  res.json({ success: true, message: 'Payment verified', data: { order_id } });
});

module.exports = { checkout, verifyPayment };
