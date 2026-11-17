const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/notifications  - newest 50, plus the unread count.
const listNotifications = asyncHandler(async (req, res) => {
  const [items] = await pool.query(
    `SELECT notification_id, type, data, link, is_read, created_at FROM Notifications
     WHERE user_id = ? ORDER BY created_at DESC, notification_id DESC LIMIT 50`,
    [req.user.user_id]
  );
  const [[{ unread }]] = await pool.query(
    'SELECT COUNT(*) AS unread FROM Notifications WHERE user_id = ? AND is_read = 0',
    [req.user.user_id]
  );
  res.json({ success: true, data: { items, unread } });
});

// GET /api/notifications/unread-count  - cheap call for the badge.
const unreadCount = asyncHandler(async (req, res) => {
  const [[row]] = await pool.query(
    'SELECT COUNT(*) AS unread, MAX(notification_id) AS latest FROM Notifications WHERE user_id = ? AND is_read = 0',
    [req.user.user_id]
  );
  res.json({ success: true, data: { unread: row.unread, latest: row.latest } });
});

// POST /api/notifications/read   Body: { ids?: number[] }  - no ids = all.
const markRead = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger).slice(0, 200) : null;
  if (ids && ids.length) {
    await pool.query('UPDATE Notifications SET is_read = 1 WHERE user_id = ? AND notification_id IN (?)', [
      req.user.user_id,
      ids,
    ]);
  } else {
    await pool.query('UPDATE Notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.user_id]);
  }
  res.json({ success: true });
});

module.exports = { listNotifications, unreadCount, markRead };
