const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const asyncHandler = require('./utils/asyncHandler');
const { isWorker } = require('./config/runtime');
const { UPLOAD_DIR, serveFromR2 } = require('./utils/storage');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const shopRoutes = require('./routes/shopRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const orderRoutes = require('./routes/orderRoutes');
const chatRoutes = require('./routes/chatRoutes');
const streamRoutes = require('./routes/streamRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const aiRoutes = require('./routes/aiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const eventRoutes = require('./routes/eventRoutes');
const rankRoutes = require('./routes/rankRoutes');

const app = express();

// Behind the Vite proxy / tunnel, so req.protocol and req.get('host') reflect
// the public address (used to build uploaded-file URLs).
app.set('trust proxy', true);

// The Phase 3 React app runs on a different origin (Vite dev server on :5173),
// so the browser blocks every API call unless we opt in here.
// CORS_ORIGIN is a comma-separated allow-list; unset means "allow anything"
// which is fine for local dev but should be set in production.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
);

// Basic hardening: no framework fingerprint, safe default headers, and a cap
// on JSON body size (livestream handshakes are the largest at ~10-20 KB).
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self)',
  });
  next();
});

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true }));

// Uploaded product photos — from disk locally, from R2 on Cloudflare
if (isWorker) {
  app.get('/uploads/:name', asyncHandler(serveFromR2));
} else {
  app.use('/uploads', express.static(UPLOAD_DIR));
}

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Enter /api/health as path',
  });
});

// Health check (extra convenience — handy for uptime checks / quick sanity test)
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'ArtiSoul API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlists', wishlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/ranks', rankRoutes);

// 404 for anything unmatched
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Must be registered last
app.use(errorHandler);

module.exports = app;
