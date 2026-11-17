const { pool } = require('../config/db');

// In-app notifications. Only a `type` and small `data` object are stored;
// the app turns them into text in the reader's own language.
//
// Types: new_order, order_status, live_scheduled, live_now, new_review,
//        low_stock, sold_out, low_stock_buyer, sold_out_buyer, review_removed,
//        cod_buyer_confirmed, cod_artisan_confirmed, cod_paid,
//        event_call, event_needs_approval, event_approved, event_rejected
async function notify(userIds, type, data = {}, link = null) {
  const ids = [...new Set([].concat(userIds).filter(Boolean).map(Number))];
  if (!ids.length) return;
  try {
    await pool.query('INSERT INTO Notifications (user_id, type, data, link) VALUES ?', [
      ids.map((id) => [id, type, JSON.stringify(data), link]),
    ]);
  } catch (err) {
    console.error('notification failed:', err.message);
  }
}

module.exports = { notify };
