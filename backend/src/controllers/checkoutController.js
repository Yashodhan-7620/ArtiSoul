const crypto = require('crypto');
const Razorpay = require('razorpay');
const { pool } = require('../config/db');
const { reserveStock, releaseStock } = require('../utils/stock');
const { addOrderEvent } = require('../utils/orderEvents');
const { notify } = require('../utils/notify');
const { audit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { parseQuantity } = require('./ordersController');

const keyId = process.env.TEST_KEY_ID;
const keySecret = process.env.TEST_KEY_SECRET;
const razorpay = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;

function validateDelivery(body) {
  const { payment_method, name, phone, address } = body;
  if (!['COD', 'UPI'].includes(payment_method)) return "payment_method must be 'COD' or 'UPI'";
  if (!name?.trim() || !/^[0-9+\-\s]{10,15}$/.test(phone || '') || !address?.trim()) {
    return 'Valid name, phone and delivery address are required';
  }
  if (name.length > 120 || address.length > 500) return 'Name or address is too long';
  if (payment_method === 'UPI' && !razorpay) return 'Online payments are not configured';
  return null;
}

// Reserves stock for every line, or for none: if one line fails, the units
// already taken for earlier lines are put back.
async function reserveAll(lines) {
  const done = [];
  for (const line of lines) {
    if (!(await reserveStock(line.product_id, line.quantity))) {
      for (const d of done) await releaseStock(d.product_id, d.quantity);
      return line;
    }
    done.push(line);
  }
  return null;
}

// Creates one order per line (sharing `checkout_ref`). Returns the order ids.
async function insertOrders(req, lines, ref) {
  const { payment_method, name, phone, address } = req.body;
  const ids = [];
  try {
    for (const l of lines) {
      const [r] = await pool.query(
        `INSERT INTO Orders (customer_id, product_id, shop_id, quantity, price_at_purchase, status,
                             payment_method, payment_status, delivery_name, delivery_phone, delivery_address,
                             checkout_ref)
         VALUES (?, ?, ?, ?, ?, 'Pending', ?, 'Pending', ?, ?, ?, ?)`,
        [req.user.user_id, l.product_id, l.shop_id, l.quantity, l.price, payment_method,
         name.trim(), phone.trim(), address.trim(), ref]
      );
      ids.push(r.insertId);
    }
  } catch (err) {
    if (ids.length) await pool.query('DELETE FROM Orders WHERE order_id IN (?)', [ids]);
    for (const l of lines) await releaseStock(l.product_id, l.quantity);
    throw err;
  }
  await addOrderEvent(ids, 'Placed', { actorId: req.user.user_id });
  return ids;
}

// Tells each artisan about their new orders (COD now; UPI once paid).
async function notifyArtisans(orderIds) {
  const [rows] = await pool.query(
    `SELECT o.order_id, o.quantity, p.name AS product_name, s.artisan_id
     FROM Orders o JOIN Products p ON p.product_id = o.product_id JOIN Shops s ON s.shop_id = o.shop_id
     WHERE o.order_id IN (?)`,
    [orderIds]
  );
  for (const r of rows) {
    await notify(r.artisan_id, 'new_order', { order_id: r.order_id, product_name: r.product_name, quantity: r.quantity }, '/artisan');
  }
}

// Opens one Razorpay payment for all the orders; undoes them if that fails.
async function startPayment(res, lines, orderIds, ref, description) {
  const amount = Math.round(lines.reduce((sum, l) => sum + l.price * l.quantity, 0) * 100); // paise
  let rzpOrder;
  try {
    rzpOrder = await razorpay.orders.create({ amount, currency: 'INR', receipt: ref.slice(0, 40) });
  } catch {
    await pool.query('DELETE FROM Orders WHERE order_id IN (?)', [orderIds]);
    for (const l of lines) await releaseStock(l.product_id, l.quantity);
    return res.status(502).json({ success: false, message: 'Could not start the payment. Please try again.' });
  }
  await pool.query('UPDATE Orders SET razorpay_order_id = ? WHERE order_id IN (?)', [rzpOrder.id, orderIds]);
  return res.status(201).json({
    success: true,
    data: {
      order_id: orderIds[0],
      order_ids: orderIds,
      payment_method: 'UPI',
      key_id: keyId,
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      description,
    },
  });
}

const newRef = () => `co_${Date.now().toString(36)}${crypto.randomBytes(5).toString('hex')}`;

// POST /api/orders/checkout
// Body: { product_id, quantity, payment_method: 'COD'|'UPI', name, phone, address }
// COD  -> order is created and confirmed immediately.
// UPI  -> order is created, a Razorpay order is opened and its details returned
//         so the client can launch Razorpay Checkout; confirm via /verify-payment.
const checkout = asyncHandler(async (req, res) => {
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ success: false, message: 'product_id is required' });
  const invalid = validateDelivery(req.body);
  if (invalid) return res.status(invalid.includes('configured') ? 503 : 400).json({ success: false, message: invalid });

  const [[product]] = await pool.query(
    'SELECT product_id, shop_id, price, stock_status, name FROM Products WHERE product_id = ?',
    [product_id]
  );
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  if (product.stock_status === 'out_of_stock') {
    return res.status(409).json({ success: false, message: 'Product is out of stock' });
  }

  const lines = [{ ...product, quantity: parseQuantity(req.body.quantity) }];
  if (await reserveAll(lines)) {
    return res.status(409).json({ success: false, message: 'Not enough stock available for that quantity' });
  }

  const ref = newRef();
  const ids = await insertOrders(req, lines, ref);
  await audit(req, 'order.checkout', { entity: 'order', entityId: ids[0], details: { method: req.body.payment_method, items: 1 } });

  if (req.body.payment_method === 'COD') {
    await notifyArtisans(ids);
    return res.status(201).json({ success: true, message: 'Order placed', data: { order_id: ids[0], order_ids: ids, payment_method: 'COD' } });
  }
  return startPayment(res, lines, ids, ref, product.name);
});

// POST /api/orders/checkout-cart
// Body: { payment_method, name, phone, address }
// Turns the whole cart into orders (one per item) paid with ONE payment.
const checkoutCart = asyncHandler(async (req, res) => {
  const invalid = validateDelivery(req.body);
  if (invalid) return res.status(invalid.includes('configured') ? 503 : 400).json({ success: false, message: invalid });

  const [lines] = await pool.query(
    `SELECT c.product_id, c.quantity, p.shop_id, p.price, p.name, p.stock_quantity
     FROM CartItems c JOIN Products p ON p.product_id = c.product_id
     WHERE c.user_id = ? ORDER BY c.added_at`,
    [req.user.user_id]
  );
  if (!lines.length) return res.status(400).json({ success: false, message: 'Your cart is empty' });

  const failed = await reserveAll(lines);
  if (failed) {
    return res.status(409).json({
      success: false,
      message: `Only ${Math.max(failed.stock_quantity, 0)} of "${failed.name}" left. Please update your cart.`,
    });
  }

  const ref = newRef();
  const ids = await insertOrders(req, lines, ref);
  await audit(req, 'order.checkout_cart', {
    entity: 'order',
    entityId: ids[0],
    details: { method: req.body.payment_method, items: lines.length },
  });

  if (req.body.payment_method === 'COD') {
    await pool.query('DELETE FROM CartItems WHERE user_id = ?', [req.user.user_id]);
    await notifyArtisans(ids);
    return res.status(201).json({ success: true, message: 'Order placed', data: { order_id: ids[0], order_ids: ids, payment_method: 'COD' } });
  }
  // UPI: the cart is emptied once the payment is verified.
  return startPayment(res, lines, ids, ref, `${lines.length} item${lines.length > 1 ? 's' : ''}`);
});

// POST /api/orders/verify-payment
// Body: { order_id, razorpay_payment_id, razorpay_signature }
// Confirms the payment for every order opened with the same Razorpay order.
const verifyPayment = asyncHandler(async (req, res) => {
  const { order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Missing payment details' });
  }

  const [[order]] = await pool.query(
    "SELECT order_id, razorpay_order_id FROM Orders WHERE order_id = ? AND customer_id = ? AND payment_method = 'UPI'",
    [order_id, req.user.user_id]
  );
  if (!order || !order.razorpay_order_id) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const [group] = await pool.query(
    `SELECT order_id, product_id, quantity, payment_status FROM Orders
     WHERE razorpay_order_id = ? AND customer_id = ?`,
    [order.razorpay_order_id, req.user.user_id]
  );
  const ids = group.map((o) => o.order_id);
  if (group.every((o) => o.payment_status === 'Paid')) {
    return res.json({ success: true, message: 'Payment already verified', data: { order_id, order_ids: ids } });
  }

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${order.razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  const valid =
    typeof razorpay_signature === 'string' &&
    expected.length === razorpay_signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));

  if (!valid) {
    // Failed payment: cancel the orders and give the stock back.
    await pool.query(
      "UPDATE Orders SET payment_status = 'Failed', status = 'Cancelled' WHERE order_id IN (?) AND payment_status <> 'Paid'",
      [ids]
    );
    for (const o of group) if (o.payment_status !== 'Paid') await releaseStock(o.product_id, o.quantity);
    await addOrderEvent(ids, 'PaymentFailed');
    await audit(req, 'payment.failed', { entity: 'order', entityId: order_id, details: { orders: ids.length } });
    return res.status(400).json({ success: false, message: 'Payment verification failed' });
  }

  await pool.query(
    "UPDATE Orders SET payment_status = 'Paid', razorpay_payment_id = ? WHERE order_id IN (?)",
    [razorpay_payment_id, ids]
  );
  await addOrderEvent(ids, 'Paid', { actorId: req.user.user_id });
  await pool.query('DELETE FROM CartItems WHERE user_id = ? AND product_id IN (?)', [
    req.user.user_id,
    group.map((o) => o.product_id),
  ]);
  await notifyArtisans(ids);
  await audit(req, 'payment.verified', { entity: 'order', entityId: order_id, details: { orders: ids.length } });
  res.json({ success: true, message: 'Payment verified', data: { order_id, order_ids: ids } });
});

module.exports = { checkout, checkoutCart, verifyPayment };
