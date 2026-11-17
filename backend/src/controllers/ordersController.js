const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { reserveStock, releaseStock, LOW_STOCK } = require('../utils/stock');
const { addOrderEvent } = require('../utils/orderEvents');
const { notify } = require('../utils/notify');
const { audit } = require('../utils/audit');

// Quantity from a request body: a whole number from 1 to 20. Anything else
// (including negatives, which would otherwise *add* stock) becomes 1.
function parseQuantity(value) {
  const q = parseInt(value, 10);
  return Number.isInteger(q) && q >= 1 ? Math.min(q, 20) : 1;
}

// Statuses an artisan may move an order to, from each status.
const NEXT_STATUS = {
  Pending: ['Accepted', 'Cancelled'],
  Accepted: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

// POST /api/orders
// Auth: customer only.
// Body: { product_id, quantity? }
// Creates a Pending order and snapshots the price.
const createOrder = asyncHandler(async (req, res) => {
  const customer_id = req.user.user_id;
  const { product_id } = req.body;
  const quantity = parseQuantity(req.body.quantity);

  if (!product_id) {
    return res.status(400).json({ success: false, message: 'product_id is required' });
  }

  const [[product]] = await pool.query(
    `SELECT p.product_id, p.shop_id, p.price, p.stock_status, p.name, s.artisan_id
     FROM Products p JOIN Shops s ON s.shop_id = p.shop_id WHERE p.product_id = ?`,
    [product_id]
  );

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  if (product.stock_status === 'out_of_stock') {
    return res.status(409).json({ success: false, message: 'Product is out of stock' });
  }

  if (!(await reserveStock(product.product_id, quantity))) {
    return res.status(409).json({ success: false, message: 'Not enough stock available' });
  }

  let result;
  try {
    [result] = await pool.query(
      `INSERT INTO Orders (customer_id, product_id, shop_id, quantity, price_at_purchase, status)
       VALUES (?, ?, ?, ?, ?, 'Pending')`,
      [customer_id, product.product_id, product.shop_id, quantity, product.price]
    );
  } catch (err) {
    await releaseStock(product.product_id, quantity);
    throw err;
  }

  await addOrderEvent(result.insertId, 'Placed', { actorId: customer_id });
  await notify(product.artisan_id, 'new_order', { order_id: result.insertId, product_name: product.name, quantity }, '/artisan');
  await audit(req, 'order.create', { entity: 'order', entityId: result.insertId, details: { quantity } });

  const [[order]] = await pool.query('SELECT * FROM Orders WHERE order_id = ?', [result.insertId]);

  res.status(201).json({ success: true, message: 'Order placed successfully', data: order });
});

// GET /api/orders/mine
// Auth: customer only. Returns the calling customer's purchase history.
const getMyOrders = asyncHandler(async (req, res) => {
  const [orders] = await pool.query(
    `SELECT o.*, p.name AS product_name, p.image_url, s.shop_name,
            COALESCE(ls.status, 'none') AS stream_status,
            r.rating AS review_rating, r.comment AS review_comment, r.created_at AS reviewed_at
     FROM Orders o
     JOIN Products p ON p.product_id = o.product_id
     JOIN Shops    s ON s.shop_id    = o.shop_id
     LEFT JOIN LiveStreams ls ON ls.order_id = o.order_id
     LEFT JOIN Reviews     r  ON r.order_id  = o.order_id
     WHERE o.customer_id = ?
     ORDER BY o.created_at DESC, o.order_id DESC`,
    [req.user.user_id]
  );
  res.json({ success: true, count: orders.length, data: orders });
});

// GET /api/orders/shop
// Auth: artisan only. Returns all incoming orders for the artisan's shop(s).
const getShopOrders = asyncHandler(async (req, res) => {
  const [orders] = await pool.query(
    `SELECT o.*, p.name AS product_name, u.name AS customer_name, u.phone AS customer_phone,
            COALESCE(ls.status, 'none') AS stream_status
     FROM Orders o
     JOIN Shops    s ON s.shop_id    = o.shop_id
     JOIN Products p ON p.product_id = o.product_id
     JOIN Users    u ON u.user_id    = o.customer_id
     LEFT JOIN LiveStreams ls ON ls.order_id = o.order_id
     WHERE s.artisan_id = ?
     ORDER BY o.created_at DESC, o.order_id DESC`,
    [req.user.user_id]
  );
  res.json({ success: true, count: orders.length, data: orders });
});

// The order if it belongs to one of this artisan's shops.
async function findArtisanOrder(orderId, artisanId) {
  const [[order]] = await pool.query(
    `SELECT o.order_id, o.customer_id, o.product_id, o.quantity, o.status, o.payment_method,
            o.payment_status, p.name AS product_name
     FROM Orders o
     JOIN Shops s ON s.shop_id = o.shop_id
     JOIN Products p ON p.product_id = o.product_id
     WHERE o.order_id = ? AND s.artisan_id = ?`,
    [orderId, artisanId]
  );
  return order;
}

// PATCH /api/orders/:id/status
// Auth: artisan only. Moves an order one step: Pending -> Accepted -> Shipped
// -> Delivered, or cancels it before it ships.
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!Object.keys(NEXT_STATUS).includes(status)) {
    return res.status(400).json({ success: false, message: 'Unknown status' });
  }

  const order = await findArtisanOrder(req.params.id, req.user.user_id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found or not yours' });
  }

  if (!NEXT_STATUS[order.status].includes(status)) {
    return res.status(409).json({ success: false, message: `An order that is ${order.status} can't be marked ${status}` });
  }
  // An online payment must have gone through before work starts on it.
  if (status === 'Accepted' && order.payment_method === 'UPI' && order.payment_status !== 'Paid') {
    return res.status(409).json({ success: false, message: 'This order has not been paid yet' });
  }

  await pool.query('UPDATE Orders SET status = ? WHERE order_id = ?', [status, order.order_id]);
  if (status === 'Cancelled') await releaseStock(order.product_id, order.quantity);
  // A stream only makes sense while the order is being made.
  if (status !== 'Accepted') {
    await pool.query(
      "UPDATE LiveStreams SET status = 'ended', offer = NULL, answer = NULL WHERE order_id = ?",
      [order.order_id]
    );
  }

  await addOrderEvent(order.order_id, status, { actorId: req.user.user_id });
  await notify(
    order.customer_id,
    'order_status',
    { order_id: order.order_id, product_name: order.product_name, status },
    '/purchases'
  );
  await audit(req, 'order.status', {
    entity: 'order',
    entityId: order.order_id,
    details: { from: order.status, to: status },
  });

  res.json({ success: true, data: { order_id: order.order_id, status } });
});

// PATCH /api/orders/:id/live-schedule   (artisan)
// Body: { scheduled_at: ISO date-time | null }
// A tentative time for the private livestream, shown to the buyer.
const scheduleLive = asyncHandler(async (req, res) => {
  const order = await findArtisanOrder(req.params.id, req.user.user_id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found or not yours' });
  if (order.status !== 'Accepted') {
    return res.status(409).json({ success: false, message: 'Livestreams can be scheduled for accepted orders only' });
  }

  let at = null;
  if (req.body.scheduled_at) {
    // Whole seconds: the DATETIME column would otherwise round the milliseconds.
    at = new Date(Math.floor(new Date(req.body.scheduled_at).getTime() / 1000) * 1000);
    const now = Date.now();
    if (Number.isNaN(at.getTime()) || at.getTime() < now - 60_000 || at.getTime() > now + 60 * 86_400_000) {
      return res.status(400).json({ success: false, message: 'Pick a time within the next 60 days' });
    }
  }

  await pool.query('UPDATE Orders SET scheduled_live_at = ? WHERE order_id = ?', [at, order.order_id]);
  if (at) {
    await addOrderEvent(order.order_id, 'LiveScheduled', { meta: { at: at.toISOString() }, actorId: req.user.user_id });
    await notify(
      order.customer_id,
      'live_scheduled',
      { order_id: order.order_id, product_name: order.product_name, at: at.toISOString() },
      '/purchases'
    );
  }
  await audit(req, 'order.live_schedule', { entity: 'order', entityId: order.order_id, details: { at: at?.toISOString() ?? null } });
  res.json({ success: true, data: { order_id: order.order_id, scheduled_live_at: at } });
});

// POST /api/orders/:id/cod-confirm   (the order's buyer or artisan)
// Cash on delivery: once the order is delivered, the buyer confirms "I paid
// the cash" and the artisan confirms "I received the cash". When both have
// confirmed, the payment is marked Paid.
const confirmCodPayment = asyncHandler(async (req, res) => {
  const [[order]] = await pool.query(
    `SELECT o.order_id, o.customer_id, o.status, o.payment_method, o.payment_status,
            o.cod_buyer_confirmed_at, o.cod_artisan_confirmed_at, s.artisan_id, p.name AS product_name
     FROM Orders o JOIN Shops s ON s.shop_id = o.shop_id JOIN Products p ON p.product_id = o.product_id
     WHERE o.order_id = ?`,
    [req.params.id]
  );
  const uid = req.user.user_id;
  const side = order?.customer_id === uid ? 'buyer' : order?.artisan_id === uid ? 'artisan' : null;
  if (!order || !side) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.payment_method !== 'COD') {
    return res.status(409).json({ success: false, message: 'Only cash-on-delivery orders are confirmed this way' });
  }
  if (order.status !== 'Delivered') {
    return res.status(409).json({ success: false, message: 'Cash payment can be confirmed once the order is delivered' });
  }
  if (order.payment_status === 'Paid') {
    return res.json({ success: true, data: { order_id: order.order_id, payment_status: 'Paid' } });
  }

  const column = side === 'buyer' ? 'cod_buyer_confirmed_at' : 'cod_artisan_confirmed_at';
  // Only the caller's own side is set, and only once.
  await pool.query(`UPDATE Orders SET ${column} = COALESCE(${column}, UTC_TIMESTAMP()) WHERE order_id = ?`, [order.order_id]);
  // Mark Paid only when both sides have confirmed (one statement, so two
  // confirmations arriving together can't both miss it).
  const [paid] = await pool.query(
    `UPDATE Orders SET payment_status = 'Paid'
     WHERE order_id = ? AND payment_status <> 'Paid'
       AND cod_buyer_confirmed_at IS NOT NULL AND cod_artisan_confirmed_at IS NOT NULL`,
    [order.order_id]
  );
  const data = { order_id: order.order_id, product_name: order.product_name };
  const otherId = side === 'buyer' ? order.artisan_id : order.customer_id;

  if (paid.affectedRows) {
    await addOrderEvent(order.order_id, 'Paid', { meta: { method: 'COD' }, actorId: uid });
    await notify(order.customer_id, 'cod_paid', data, '/purchases');
    await notify(order.artisan_id, 'cod_paid', data, '/artisan');
  } else if (!order[column]) {
    await notify(otherId, side === 'buyer' ? 'cod_buyer_confirmed' : 'cod_artisan_confirmed', data,
      side === 'buyer' ? '/artisan' : '/purchases');
  }
  await audit(req, 'payment.cod_confirm', { entity: 'order', entityId: order.order_id, details: { side, paid: Boolean(paid.affectedRows) } });

  const [[now]] = await pool.query(
    'SELECT payment_status, cod_buyer_confirmed_at, cod_artisan_confirmed_at FROM Orders WHERE order_id = ?',
    [order.order_id]
  );
  res.json({ success: true, data: { order_id: order.order_id, ...now } });
});

// GET /api/orders/:id/timeline   (the order's customer or artisan)
const getTimeline = asyncHandler(async (req, res) => {
  const [[order]] = await pool.query(
    `SELECT o.order_id, o.status, o.payment_method, o.payment_status, o.scheduled_live_at, o.created_at,
            o.customer_id, s.artisan_id
     FROM Orders o JOIN Shops s ON s.shop_id = o.shop_id WHERE o.order_id = ?`,
    [req.params.id]
  );
  const uid = req.user.user_id;
  if (!order || (order.customer_id !== uid && order.artisan_id !== uid)) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const [events] = await pool.query(
    'SELECT event, meta, created_at FROM OrderEvents WHERE order_id = ? ORDER BY created_at, event_id',
    [order.order_id]
  );
  res.json({
    success: true,
    data: {
      order_id: order.order_id,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      scheduled_live_at: order.scheduled_live_at,
      events,
    },
  });
});

// GET /api/orders/sales   (artisan) - numbers for the sales dashboard.
// Counts every order except cancelled ones and unpaid online payments.
const getSales = asyncHandler(async (req, res) => {
  const uid = req.user.user_id;
  const COUNTED = `o.status <> 'Cancelled' AND NOT (o.payment_method = 'UPI' AND o.payment_status <> 'Paid')`;

  const [monthly] = await pool.query(
    `SELECT DATE_FORMAT(o.created_at, '%Y-%m') AS month, COUNT(*) AS orders,
            SUM(o.quantity) AS units, SUM(o.price_at_purchase * o.quantity) AS revenue
     FROM Orders o JOIN Shops s ON s.shop_id = o.shop_id
     WHERE s.artisan_id = ? AND ${COUNTED}
       AND o.created_at >= DATE_FORMAT(UTC_TIMESTAMP() - INTERVAL 11 MONTH, '%Y-%m-01')
     GROUP BY month ORDER BY month`,
    [uid]
  );

  const [[totals]] = await pool.query(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(o.quantity), 0) AS units,
            COALESCE(SUM(o.price_at_purchase * o.quantity), 0) AS revenue,
            COALESCE(SUM(IF(o.status = 'Delivered', o.price_at_purchase * o.quantity, 0)), 0) AS delivered_revenue,
            COUNT(DISTINCT o.customer_id) AS customers
     FROM Orders o JOIN Shops s ON s.shop_id = o.shop_id
     WHERE s.artisan_id = ? AND ${COUNTED}`,
    [uid]
  );

  const [byStatus] = await pool.query(
    `SELECT o.status, COUNT(*) AS n FROM Orders o JOIN Shops s ON s.shop_id = o.shop_id
     WHERE s.artisan_id = ? GROUP BY o.status`,
    [uid]
  );

  const [topProducts] = await pool.query(
    `SELECT p.product_id, p.name, SUM(o.quantity) AS units, SUM(o.price_at_purchase * o.quantity) AS revenue
     FROM Orders o JOIN Shops s ON s.shop_id = o.shop_id JOIN Products p ON p.product_id = o.product_id
     WHERE s.artisan_id = ? AND ${COUNTED}
     GROUP BY p.product_id, p.name ORDER BY revenue DESC LIMIT 5`,
    [uid]
  );

  const [[rating]] = await pool.query(
    `SELECT ROUND(AVG(r.rating), 1) AS avg_rating, COUNT(*) AS reviews
     FROM Reviews r JOIN Products p ON p.product_id = r.product_id JOIN Shops s ON s.shop_id = p.shop_id
     WHERE s.artisan_id = ?`,
    [uid]
  );

  const [lowStock] = await pool.query(
    `SELECT p.product_id, p.name, p.stock_quantity FROM Products p JOIN Shops s ON s.shop_id = p.shop_id
     WHERE s.artisan_id = ? AND p.stock_quantity <= ? ORDER BY p.stock_quantity, p.name`,
    [uid, LOW_STOCK]
  );

  res.json({
    success: true,
    data: {
      monthly,
      totals,
      by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
      top_products: topProducts,
      rating: { avg: Number(rating.avg_rating) || 0, count: rating.reviews },
      low_stock: lowStock,
      low_stock_threshold: LOW_STOCK,
    },
  });
});

module.exports = {
  createOrder,
  getMyOrders,
  getShopOrders,
  updateOrderStatus,
  scheduleLive,
  confirmCodPayment,
  getTimeline,
  getSales,
  parseQuantity,
};
