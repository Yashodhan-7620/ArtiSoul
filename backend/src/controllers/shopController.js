const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/shops/create
// Auth: artisan only. Body: { shop_name, latitude, longitude, address }
// (Extra convenience route — a product can't be added without a shop_id,
// and a shop can't exist without this endpoint.)
const createShop = asyncHandler(async (req, res) => {
  const artisan_id = req.user.user_id;
  const { shop_name, latitude, longitude, address } = req.body;

  if (!shop_name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'shop_name, latitude and longitude are required' });
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return res.status(400).json({ success: false, message: 'latitude/longitude out of range' });
  }

  const [result] = await pool.query(
    'INSERT INTO Shops (artisan_id, shop_name, latitude, longitude, address) VALUES (?, ?, ?, ?, ?)',
    [artisan_id, shop_name, latitude, longitude, address || null]
  );

  res.status(201).json({
    success: true,
    message: 'Shop created successfully',
    data: { shop_id: result.insertId, artisan_id, shop_name, latitude, longitude, address },
  });
});

// GET /api/shops/mine
// Auth: artisan only. Returns the calling artisan's shop(s).
const getMyShops = asyncHandler(async (req, res) => {
  const artisan_id = req.user.user_id;
  const [rows] = await pool.query('SELECT * FROM Shops WHERE artisan_id = ?', [artisan_id]);
  res.json({ success: true, data: rows });
});

// PUT /api/shops/my-qr
// Auth: artisan only. Body: { upi_qr_url }
const updateShopQr = asyncHandler(async (req, res) => {
  const artisan_id = req.user.user_id;
  const { upi_qr_url } = req.body;

  if (!upi_qr_url) {
    return res.status(400).json({ success: false, message: 'QR code image URL is required' });
  }

  const [result] = await pool.query(
    'UPDATE Shops SET upi_qr_url = ? WHERE artisan_id = ?',
    [upi_qr_url, artisan_id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({
      success: false,
      message: 'Please create your shop first before uploading a payment QR code.',
    });
  }

  res.json({
    success: true,
    message: 'UPI QR code updated successfully',
    data: { upi_qr_url },
  });
});

// GET /api/shops/qr/:shopId
// Public/Customer route to fetch the shop's UPI QR code at checkout
const getShopQr = asyncHandler(async (req, res) => {
  const [[shop]] = await pool.query(
    'SELECT shop_id, shop_name, upi_qr_url FROM Shops WHERE shop_id = ?',
    [req.params.shopId]
  );

  if (!shop) {
    return res.status(404).json({ success: false, message: 'Shop not found' });
  }

  res.json({ success: true, data: shop });
});

module.exports = { createShop, getMyShops, updateShopQr, getShopQr };