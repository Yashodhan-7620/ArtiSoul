const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { audit, recentCount } = require('../utils/audit');

// Brute-force protection: after this many wrong passwords for one phone
// number (or from one network) in the window, logins are refused for a while.
const MAX_FAILS_PER_PHONE = 5;
const MAX_FAILS_PER_IP = 20;
const FAIL_WINDOW_MIN = 15;

const PHONE_REGEX = /^[0-9]{10,15}$/;

function signToken(user) {
  return jwt.sign(
    { user_id: user.user_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register
// Body: { role: 'artisan' | 'customer', name, phone, password }
const register = asyncHandler(async (req, res) => {
  const { role, name, phone, password } = req.body;

  if (!role || !name || !phone || !password) {
    return res.status(400).json({ success: false, message: 'role, name, phone and password are required' });
  }

  if (!['artisan', 'customer'].includes(role)) {
    return res.status(400).json({ success: false, message: "role must be 'artisan' or 'customer'" });
  }

  if (!PHONE_REGEX.test(phone)) {
    return res.status(400).json({ success: false, message: 'phone must be 10-15 digits' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'password must be at least 6 characters' });
  }

  const [existing] = await pool.query('SELECT user_id FROM Users WHERE phone = ?', [phone]);
  if (existing.length > 0) {
    return res.status(409).json({ success: false, message: 'An account with this phone number already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [result] = await pool.query(
    'INSERT INTO Users (role, name, phone, password) VALUES (?, ?, ?, ?)',
    [role, name, phone, passwordHash]
  );

  const user = { user_id: result.insertId, role };
  const token = signToken(user);
  await audit(req, 'auth.register', { actor: user, entity: 'user', entityId: user.user_id, details: { role } });

  res.status(201).json({
    success: true,
    message: 'Registered successfully',
    data: {
      user: { user_id: user.user_id, role, name, phone },
      token,
    },
  });
});




// POST /api/auth/login
// Body: { phone, password }
// (Extra convenience route — not in the spec, but register() is useless
// without a way to log back in.)
const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ success: false, message: 'phone and password are required' });
  }

  const fails = await recentCount('auth.login_failed', { subject: phone, req, minutes: FAIL_WINDOW_MIN });
  if (fails.bySubject >= MAX_FAILS_PER_PHONE || fails.byIp >= MAX_FAILS_PER_IP) {
    await audit(req, 'auth.login_blocked', { subject: phone });
    return res.status(429).json({
      success: false,
      message: `Too many failed attempts. Please wait ${FAIL_WINDOW_MIN} minutes and try again.`,
    });
  }

  const [rows] = await pool.query('SELECT * FROM Users WHERE phone = ?', [String(phone)]);
  const user = rows[0];
  // Same message whether the phone or the password was wrong, so the login
  // form can't be used to discover which numbers have accounts.
  if (!user || !(await bcrypt.compare(String(password), user.password))) {
    await audit(req, 'auth.login_failed', { subject: phone, entity: user ? 'user' : null, entityId: user?.user_id });
    return res.status(401).json({ success: false, message: 'Invalid phone or password' });
  }

  if (!user.is_active) {
    await audit(req, 'auth.login_suspended', { actor: user, entity: 'user', entityId: user.user_id });
    return res.status(403).json({ success: false, message: 'This account has been suspended' });
  }

  const token = signToken(user);
  await audit(req, 'auth.login', { actor: user, entity: 'user', entityId: user.user_id });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: { user_id: user.user_id, role: user.role, name: user.name, phone: user.phone },
      token,
    },
  });
});

module.exports = { register, login };
