const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// Private order livestreams.
//
// The video itself travels peer-to-peer (WebRTC) from the artisan's camera to
// the one customer who placed the order. The server only relays the
// connection handshake, so this works the same under Node and Cloudflare
// Workers (no long-lived sockets needed). Every query is scoped to the order's
// own artisan or customer, so nobody else can see or join a stream.

const MAX_SDP = 100000;

function validSdp(desc, type) {
  return (
    desc &&
    typeof desc === 'object' &&
    desc.type === type &&
    typeof desc.sdp === 'string' &&
    desc.sdp.length > 0 &&
    desc.sdp.length < MAX_SDP
  );
}

// The order, if the caller is its artisan (via shop ownership) or its customer.
async function findOrderFor(orderId, user) {
  const [[order]] = await pool.query(
    `SELECT o.order_id, o.customer_id, o.status, s.artisan_id
     FROM Orders o JOIN Shops s ON s.shop_id = o.shop_id
     WHERE o.order_id = ? AND (s.artisan_id = ? OR o.customer_id = ?)`,
    [orderId, user.user_id, user.user_id]
  );
  if (!order) return null;
  if (user.role === 'artisan' && order.artisan_id !== user.user_id) return null;
  if (user.role === 'customer' && order.customer_id !== user.user_id) return null;
  return order;
}

async function getStream(orderId) {
  const [[stream]] = await pool.query('SELECT * FROM LiveStreams WHERE order_id = ?', [orderId]);
  return stream;
}

function parse(json) {
  try {
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

// POST /api/streams/:orderId/start   (artisan)   body: { offer }
// Goes live, or restarts a stream with a fresh offer.
const startStream = asyncHandler(async (req, res) => {
  const order = await findOrderFor(req.params.orderId, req.user);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found or not yours' });
  if (order.status !== 'Accepted') {
    return res.status(409).json({ success: false, message: 'Accept the order before starting a livestream' });
  }
  if (!validSdp(req.body.offer, 'offer')) {
    return res.status(400).json({ success: false, message: 'A valid WebRTC offer is required' });
  }

  await pool.query(
    `INSERT INTO LiveStreams (order_id, artisan_id, customer_id, status, version, offer, answer)
     VALUES (?, ?, ?, 'live', 1, ?, NULL)
     ON DUPLICATE KEY UPDATE status = 'live', version = version + 1,
                             offer = VALUES(offer), answer = NULL, started_at = CURRENT_TIMESTAMP`,
    [order.order_id, order.artisan_id, order.customer_id, JSON.stringify(req.body.offer)]
  );
  const stream = await getStream(order.order_id);
  res.status(201).json({ success: true, data: { status: stream.status, version: stream.version } });
});

// PUT /api/streams/:orderId/offer   (artisan)   body: { offer, version }
// Answers a viewer's rejoin request with a new offer for that version.
const updateOffer = asyncHandler(async (req, res) => {
  const order = await findOrderFor(req.params.orderId, req.user);
  if (!order || req.user.role !== 'artisan') {
    return res.status(404).json({ success: false, message: 'Order not found or not yours' });
  }
  if (!validSdp(req.body.offer, 'offer')) {
    return res.status(400).json({ success: false, message: 'A valid WebRTC offer is required' });
  }
  const [result] = await pool.query(
    `UPDATE LiveStreams SET offer = ?, answer = NULL
     WHERE order_id = ? AND version = ? AND status = 'live'`,
    [JSON.stringify(req.body.offer), order.order_id, Number(req.body.version)]
  );
  if (!result.affectedRows) {
    return res.status(409).json({ success: false, message: 'Stream has moved on; refresh it' });
  }
  res.json({ success: true, data: { version: Number(req.body.version) } });
});

// GET /api/streams/:orderId   (artisan or the order's customer)
// The artisan receives the viewer's answer; the customer receives the offer.
const getStreamState = asyncHandler(async (req, res) => {
  const order = await findOrderFor(req.params.orderId, req.user);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  const stream = await getStream(order.order_id);
  if (!stream) return res.json({ success: true, data: { status: 'none' } });

  const isArtisan = req.user.role === 'artisan';
  res.json({
    success: true,
    data: {
      status: stream.status,
      version: stream.version,
      started_at: stream.started_at,
      ...(isArtisan
        ? { answer: parse(stream.answer), needs_offer: stream.status === 'live' && !stream.offer }
        : { offer: stream.status === 'live' ? parse(stream.offer) : null, answered: !!stream.answer }),
    },
  });
});

// POST /api/streams/:orderId/answer   (customer)   body: { answer, version }
const postAnswer = asyncHandler(async (req, res) => {
  const order = await findOrderFor(req.params.orderId, req.user);
  if (!order || req.user.role !== 'customer') {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (!validSdp(req.body.answer, 'answer')) {
    return res.status(400).json({ success: false, message: 'A valid WebRTC answer is required' });
  }
  const [result] = await pool.query(
    `UPDATE LiveStreams SET answer = ?
     WHERE order_id = ? AND version = ? AND status = 'live' AND offer IS NOT NULL AND answer IS NULL`,
    [JSON.stringify(req.body.answer), order.order_id, Number(req.body.version)]
  );
  if (!result.affectedRows) {
    return res.status(409).json({ success: false, message: 'Stream has moved on; rejoin it' });
  }
  res.json({ success: true });
});

// POST /api/streams/:orderId/rejoin   (customer)
// The viewer reloaded or lost the connection: ask the artisan for a new offer.
const rejoin = asyncHandler(async (req, res) => {
  const order = await findOrderFor(req.params.orderId, req.user);
  if (!order || req.user.role !== 'customer') {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  await pool.query(
    `UPDATE LiveStreams SET version = version + 1, offer = NULL, answer = NULL
     WHERE order_id = ? AND status = 'live'`,
    [order.order_id]
  );
  const stream = await getStream(order.order_id);
  res.json({ success: true, data: { status: stream?.status ?? 'none', version: stream?.version } });
});

// POST /api/streams/:orderId/end   (artisan)
const endStream = asyncHandler(async (req, res) => {
  const order = await findOrderFor(req.params.orderId, req.user);
  if (!order || req.user.role !== 'artisan') {
    return res.status(404).json({ success: false, message: 'Order not found or not yours' });
  }
  await pool.query(
    "UPDATE LiveStreams SET status = 'ended', offer = NULL, answer = NULL WHERE order_id = ?",
    [order.order_id]
  );
  res.json({ success: true, data: { status: 'ended' } });
});

module.exports = { startStream, updateOffer, getStreamState, postAnswer, rejoin, endStream };
