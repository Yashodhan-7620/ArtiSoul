const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

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

  const [rows] = await pool.query('SELECT * FROM Users WHERE phone = ?', [phone]);
  if (rows.length === 0) {
    return res.status(401).json({ success: false, message: 'Invalid phone or password' });
  }

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Invalid phone or password' });
  }

  const token = signToken(user);

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
