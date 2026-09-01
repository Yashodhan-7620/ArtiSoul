const express = require('express');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const shopRoutes = require('./routes/shopRoutes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/",(req,res)=>{
  res.json({
    success:true , message:"Enter /api/health as path"
  })
})
// Health check (extra convenience — handy for uptime checks / quick sanity test)
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'ArtiSoul API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/shops', shopRoutes);

// 404 for anything unmatched
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Must be registered last
app.use(errorHandler);

module.exports = app;
