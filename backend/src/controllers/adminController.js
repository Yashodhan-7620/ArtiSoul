const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { audit, maskPhone } = require('../utils/audit');
const { notify } = require('../utils/notify');

// Admin panel API. Privacy rules for admins:
// - phone numbers are always masked; password hashes, chat messages, delivery
//   addresses and livestream data are never returned;
// - IPs appear only as anonymous hashes from the activity log;
// - every admin read of personal data and every admin action is itself logged.

const LIMIT_MAX = 100;
const limitOf = (q) => Math.min(Math.max(parseInt(q, 10) || 50, 1), LIMIT_MAX);

// GET /api/admin/overview
const overview = asyncHandler(async (req, res) => {
  const [[users]] = await pool.query(
    `SELECT COUNT(*) AS total, SUM(role = 'customer') AS customers, SUM(role = 'artisan') AS artisans,
            SUM(role = 'admin') AS admins, SUM(is_active = 0) AS suspended,
            SUM(created_at > UTC_TIMESTAMP() - INTERVAL 7 DAY) AS new_7d
     FROM Users`
  );
  const [[catalog]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM Shops) AS shops, (SELECT COUNT(*) FROM Products) AS products,
            (SELECT COUNT(*) FROM Reviews) AS reviews`
  );
  const [orders] = await pool.query('SELECT status, COUNT(*) AS n FROM Orders GROUP BY status');
  const [[gmv]] = await pool.query(
    `SELECT COALESCE(SUM(price_at_purchase * quantity), 0) AS value FROM Orders
     WHERE status <> 'Cancelled' AND NOT (payment_method = 'UPI' AND payment_status <> 'Paid')`
  );
  const [[security]] = await pool.query(
    `SELECT SUM(action = 'auth.login_failed') AS failed_logins_24h, SUM(action = 'auth.login_blocked') AS blocked_logins_24h,
            SUM(action = 'auth.login') AS logins_24h, COUNT(*) AS events_24h
     FROM AuditLog WHERE created_at > UTC_TIMESTAMP() - INTERVAL 1 DAY`
  );
  res.json({
    success: true,
    data: {
      users,
      catalog,
      orders: Object.fromEntries(orders.map((o) => [o.status, o.n])),
      order_value: gmv.value,
      security: Object.fromEntries(Object.entries(security).map(([k, v]) => [k, Number(v) || 0])),
    },
  });
});

// GET /api/admin/activity?action=&role=&actor_id=&before=&limit=
const activity = asyncHandler(async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.action) {
    where.push('l.action LIKE ?');
    params.push(`${String(req.query.action).replace(/[%_]/g, '')}%`);
  }
  if (req.query.role) {
    where.push('l.actor_role = ?');
    params.push(String(req.query.role));
  }
  if (req.query.actor_id) {
    where.push('l.actor_id = ?');
    params.push(Number(req.query.actor_id));
  }
  if (req.query.before) {
    where.push('l.log_id < ?');
    params.push(Number(req.query.before));
  }
  const limit = limitOf(req.query.limit);
  const [rows] = await pool.query(
    `SELECT l.log_id, l.actor_id, l.actor_role, u.name AS actor_name, l.action, l.entity, l.entity_id,
            l.subject_hash, l.ip_hash, l.details, l.created_at
     FROM AuditLog l LEFT JOIN Users u ON u.user_id = l.actor_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY l.log_id DESC LIMIT ?`,
    [...params, limit]
  );
  await audit(req, 'admin.view_activity', { details: { filters: { action: req.query.action || null, role: req.query.role || null } } });
  res.json({ success: true, data: { items: rows, next: rows.length === limit ? rows[rows.length - 1].log_id : null } });
});

// GET /api/admin/users?q=&role=
const users = asyncHandler(async (req, res) => {
  const where = [];
  const params = [];
  const q = String(req.query.q || '').trim();
  if (q) {
    // Name search, or an exact full phone number (it is still returned masked).
    where.push('(u.name LIKE ? OR u.phone = ?)');
    params.push(`%${q.replace(/[%_]/g, '')}%`, q);
  }
  if (['customer', 'artisan', 'admin'].includes(req.query.role)) {
    where.push('u.role = ?');
    params.push(req.query.role);
  }
  const [rows] = await pool.query(
    `SELECT u.user_id, u.name, u.phone, u.role, u.is_active, u.created_at,
            (SELECT COUNT(*) FROM Orders o WHERE o.customer_id = u.user_id) AS orders,
            (SELECT COUNT(*) FROM Shops s WHERE s.artisan_id = u.user_id) AS shops
     FROM Users u ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY u.created_at DESC, u.user_id DESC LIMIT ?`,
    [...params, limitOf(req.query.limit)]
  );
  await audit(req, 'admin.view_users', { details: { searched: Boolean(q) } });
  res.json({ success: true, data: rows.map(({ phone, ...u }) => ({ ...u, phone: maskPhone(phone) })) });
});

// PATCH /api/admin/users/:id/status   Body: { active: boolean, reason }
const setUserStatus = asyncHandler(async (req, res) => {
  const active = req.body.active === true;
  const reason = String(req.body.reason || '').trim().slice(0, 200);
  if (!active && !reason) return res.status(400).json({ success: false, message: 'Give a reason for suspending' });
  const [[target]] = await pool.query('SELECT user_id, role FROM Users WHERE user_id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ success: false, message: 'User not found' });
  if (target.role === 'admin' || target.user_id === req.user.user_id) {
    return res.status(403).json({ success: false, message: 'Admin accounts cannot be suspended here' });
  }
  await pool.query('UPDATE Users SET is_active = ? WHERE user_id = ?', [active ? 1 : 0, target.user_id]);
  await audit(req, active ? 'admin.user_restore' : 'admin.user_suspend', {
    entity: 'user',
    entityId: target.user_id,
    details: reason ? { reason } : null,
  });
  res.json({ success: true, data: { user_id: target.user_id, is_active: active } });
});

// GET /api/admin/orders?status=
const orders = asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (['Pending', 'Accepted', 'Shipped', 'Delivered', 'Cancelled'].includes(req.query.status)) {
    where = 'WHERE o.status = ?';
    params.push(req.query.status);
  }
  // Deliberately no delivery name, phone or address.
  const [rows] = await pool.query(
    `SELECT o.order_id, o.status, o.quantity, o.price_at_purchase, o.payment_method, o.payment_status,
            o.created_at, o.customer_id, p.name AS product_name, s.shop_name
     FROM Orders o JOIN Products p ON p.product_id = o.product_id JOIN Shops s ON s.shop_id = o.shop_id
     ${where} ORDER BY o.order_id DESC LIMIT ?`,
    [...params, limitOf(req.query.limit)]
  );
  await audit(req, 'admin.view_orders');
  res.json({ success: true, data: rows });
});

// GET /api/admin/reviews
const reviews = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.review_id, r.rating, r.comment, r.created_at, r.customer_id, p.product_id, p.name AS product_name,
            SUBSTRING_INDEX(u.name, ' ', 1) AS reviewer
     FROM Reviews r JOIN Products p ON p.product_id = r.product_id JOIN Users u ON u.user_id = r.customer_id
     ORDER BY r.review_id DESC LIMIT ?`,
    [limitOf(req.query.limit)]
  );
  res.json({ success: true, data: rows });
});

// DELETE /api/admin/reviews/:id   Body: { reason }
// Moderation only (spam, abuse). Buyers themselves can never edit or delete reviews.
const removeReview = asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || '').trim().slice(0, 200);
  if (!reason) return res.status(400).json({ success: false, message: 'Give a reason for removing the review' });
  const [[review]] = await pool.query(
    `SELECT r.review_id, r.customer_id, r.rating, p.name AS product_name
     FROM Reviews r JOIN Products p ON p.product_id = r.product_id WHERE r.review_id = ?`,
    [req.params.id]
  );
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
  await pool.query('DELETE FROM Reviews WHERE review_id = ?', [review.review_id]);
  await notify(review.customer_id, 'review_removed', { product_name: review.product_name, reason }, '/purchases');
  await audit(req, 'admin.review_remove', { entity: 'review', entityId: review.review_id, details: { reason, rating: review.rating } });
  res.json({ success: true });
});

module.exports = { overview, activity, users, setUserStatus, orders, reviews, removeReview };
