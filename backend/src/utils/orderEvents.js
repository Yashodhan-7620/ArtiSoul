const { pool } = require('../config/db');

// One row per step of an order, shown as the order timeline.
// Events: Placed, Paid, PaymentFailed, Accepted, LiveScheduled, LiveStarted,
//         Shipped, Delivered, Cancelled
async function addOrderEvent(orderIds, event, { meta = null, actorId = null } = {}) {
  const ids = [].concat(orderIds).filter(Boolean);
  if (!ids.length) return;
  await pool.query('INSERT INTO OrderEvents (order_id, event, meta, actor_id) VALUES ?', [
    ids.map((id) => [id, event, meta ? JSON.stringify(meta) : null, actorId]),
  ]);
}

module.exports = { addOrderEvent };
