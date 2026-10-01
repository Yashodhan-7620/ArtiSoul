const path = require('path');
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const shopRoutes = require('./routes/shopRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const orderRoutes = require('./routes/orderRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploaded product photos
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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

// 404 for anything unmatched
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Must be registered last
app.use(errorHandler);

module.exports = app;
