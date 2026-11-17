const crypto = require('crypto');
const { pool } = require('../config/db');

// Activity log for the admin panel.
//
// Privacy rules (keep them when adding new calls):
// - never pass passwords, tokens, chat text, delivery addresses or full phone
//   numbers in `details`
// - IP addresses and login phone numbers are stored only as keyed hashes:
//   the same IP/phone always gives the same 16-char value (so repeated abuse
//   is visible and rate limits work), but it cannot be turned back into the
//   original without the server's secret.

function keyedHash(value) {
  if (value === undefined || value === null || value === '') return null;
  return crypto
    .createHmac('sha256', `${process.env.JWT_SECRET || 'artisoul'}:audit`)
    .update(String(value))
    .digest('hex')
    .slice(0, 16);
}

function clientIp(req) {
  return req?.ip || req?.socket?.remoteAddress || null;
}

// Never throws: a logging failure must not break the action being logged.
async function audit(req, action, { entity = null, entityId = null, details = null, subject = null, actor = null } = {}) {
  try {
    const user = actor || req?.user || null;
    await pool.query(
      `INSERT INTO AuditLog (actor_id, actor_role, action, entity, entity_id, subject_hash, ip_hash, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user?.user_id ?? null,
        user?.role ?? null,
        action,
        entity,
        entityId === null || entityId === undefined ? null : Number(entityId),
        keyedHash(subject),
        keyedHash(clientIp(req)),
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (err) {
    console.error('audit log failed:', err.message);
  }
}

// How many times `action` happened for this subject / IP recently.
async function recentCount(action, { subject, req, minutes }) {
  const [[row]] = await pool.query(
    `SELECT
       SUM(subject_hash = ?) AS by_subject,
       SUM(ip_hash = ?)      AS by_ip
     FROM AuditLog
     WHERE action = ? AND created_at > (UTC_TIMESTAMP() - INTERVAL ? MINUTE)`,
    [keyedHash(subject), keyedHash(clientIp(req)), action, minutes]
  );
  return { bySubject: Number(row.by_subject) || 0, byIp: Number(row.by_ip) || 0 };
}

// "9876543210" -> "98******10". Admins see enough to tell users apart, not to call them.
function maskPhone(phone) {
  const p = String(phone || '');
  if (p.length <= 4) return '*'.repeat(p.length);
  return `${p.slice(0, 2)}${'*'.repeat(p.length - 4)}${p.slice(-2)}`;
}

module.exports = { audit, keyedHash, recentCount, maskPhone };
