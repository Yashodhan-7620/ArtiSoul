const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { audit } = require('../utils/audit');

const isImageUrl = (u) => typeof u === 'string' && /^(https?:\/\/|\/uploads\/)\S+$/.test(u) && u.length <= 500;

// POST /api/shops/create
// Auth: artisan only. Body: { shop_name, latitude, longitude, address }
// (Extra convenience route — a product can't be added without a shop_id,
// and a shop can't exist without this endpoint.)
const createShop = asyncHandler(async (req, res) => {
  const artisan_id = req.user.user_id;
  const { shop_name, latitude, longitude, address, image_url } = req.body;

  if (!shop_name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'shop_name, latitude and longitude are required' });
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return res.status(400).json({ success: false, message: 'latitude/longitude out of range' });
  }
  if (image_url && !isImageUrl(image_url)) {
    return res.status(400).json({ success: false, message: 'Invalid shop picture' });
  }

  const [result] = await pool.query(
    'INSERT INTO Shops (artisan_id, shop_name, latitude, longitude, address, image_url) VALUES (?, ?, ?, ?, ?, ?)',
    [artisan_id, shop_name, latitude, longitude, address || null, image_url || null]
  );
  await audit(req, 'shop.create', { entity: 'shop', entityId: result.insertId });

  res.status(201).json({
    success: true,
    message: 'Shop created successfully',
    data: { shop_id: result.insertId, artisan_id, shop_name, latitude, longitude, address, image_url: image_url || null },
  });
});

// POST /api/shops/:id/image   Body: { image_url }
// Shop details are final once created; a shop created without a picture may
// add one, once.
const setShopImage = asyncHandler(async (req, res) => {
  if (!isImageUrl(req.body.image_url)) {
    return res.status(400).json({ success: false, message: 'Invalid shop picture' });
  }
  const [r] = await pool.query(
    'UPDATE Shops SET image_url = ? WHERE shop_id = ? AND artisan_id = ? AND image_url IS NULL',
    [req.body.image_url, req.params.id, req.user.user_id]
  );
  if (!r.affectedRows) {
    return res.status(409).json({ success: false, message: 'This shop already has a picture, or is not yours' });
  }
  await audit(req, 'shop.image', { entity: 'shop', entityId: req.params.id });
  res.json({ success: true, data: { shop_id: Number(req.params.id), image_url: req.body.image_url } });
});

// GET /api/shops/mine
// Auth: artisan only. Returns the calling artisan's shop(s).
const getMyShops = asyncHandler(async (req, res) => {
  const artisan_id = req.user.user_id;
  const [rows] = await pool.query('SELECT * FROM Shops WHERE artisan_id = ?', [artisan_id]);
  res.json({ success: true, data: rows });
});

module.exports = { createShop, getMyShops, setShopImage };
