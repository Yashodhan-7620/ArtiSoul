const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

function readToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    return undefined; // present but invalid/expired
  }
}

// The token proves who the caller is; the database says what they may do now.
// So a suspended account is locked out immediately (not when its token
// expires), and a role change (e.g. promotion to admin) applies at once.
async function loadUser(decoded) {
  const [[user]] = await pool.query('SELECT user_id, role, is_active FROM Users WHERE user_id = ?', [
    decoded.user_id,
  ]);
  return user;
}

// Verifies the Bearer token and attaches { user_id, role } to req.user.
async function verifyToken(req, res, next) {
  const decoded = readToken(req);
  if (decoded === null) return res.status(401).json({ success: false, message: 'No token provided' });
  if (decoded === undefined) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
  try {
    const user = await loadUser(decoded);
    if (!user) return res.status(401).json({ success: false, message: 'Account not found' });
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'This account has been suspended' });
    }
    req.user = { user_id: user.user_id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

// Like verifyToken, but lets anonymous visitors through (req.user stays unset).
async function optionalAuth(req, res, next) {
  const decoded = readToken(req);
  if (!decoded) return next();
  try {
    const user = await loadUser(decoded);
    if (user?.is_active) req.user = { user_id: user.user_id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

// Restricts a route to specific roles, e.g. requireRole('artisan').
// Must run after verifyToken.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role' });
    }
    next();
  };
}

module.exports = { verifyToken, optionalAuth, requireRole };
