const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/products/add
// Auth: artisan only.
// Body: { shop_id, name, price, category, image_url, description, stock_status }
const addProduct = asyncHandler(async (req, res) => {
  const artisan_id = req.user.user_id;
  const { shop_id, name, price, category, image_url, description, stock_status } = req.body;

  if (!shop_id || !name || price === undefined) {
    return res.status(400).json({ success: false, message: 'shop_id, name and price are required' });
  }

  if (isNaN(price) || Number(price) < 0) {
    return res.status(400).json({ success: false, message: 'price must be a non-negative number' });
  }

  if (stock_status && !['in_stock', 'out_of_stock'].includes(stock_status)) {
    return res.status(400).json({ success: false, message: "stock_status must be 'in_stock' or 'out_of_stock'" });
  }

  // Make sure this shop actually belongs to the artisan making the request,
  // so one artisan can't add products into someone else's shop.
  const [shopRows] = await pool.query(
    'SELECT shop_id FROM Shops WHERE shop_id = ? AND artisan_id = ?',
    [shop_id, artisan_id]
  );
  if (shopRows.length === 0) {
    return res.status(403).json({ success: false, message: 'This shop does not belong to you, or does not exist' });
  }

  const [result] = await pool.query(
    `INSERT INTO Products (shop_id, name, price, category, image_url, description, stock_status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [shop_id, name, price, category || null, image_url || null, description || null, stock_status || 'in_stock']
  );

  res.status(201).json({
    success: true,
    message: 'Product added successfully',
    data: {
      product_id: result.insertId,
      shop_id,
      name,
      price,
      category: category || null,
      image_url: image_url || null,
      description: description || null,
      stock_status: stock_status || 'in_stock',
    },
  });
});

// GET /api/products/nearby?lat=..&lng=..&radius=5&category=..
// Public route — a customer does not need to be logged in to browse.
// Uses the Haversine formula (same one sketched in the schema file) to
// find products whose shop falls within `radius` km of the customer.
const getNearbyProducts = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;
  const radius = req.query.radius ? Number(req.query.radius) : 5;
  const { category } = req.query;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ success: false, message: 'lat and lng query params are required' });
  }

  const latitude = Number(lat);
  const longitude = Number(lng);

  if (isNaN(latitude) || isNaN(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return res.status(400).json({ success: false, message: 'lat/lng must be valid coordinates' });
  }

  if (isNaN(radius) || radius <= 0) {
    return res.status(400).json({ success: false, message: 'radius must be a positive number' });
  }

  const params = [latitude, longitude, latitude];
  let categoryFilter = '';
  if (category) {
    categoryFilter = 'AND p.category = ?';
    params.push(category);
  }
  params.push(radius);

  const [rows] = await pool.query(
    `
    SELECT
        p.product_id, p.name, p.price, p.category, p.image_url,
        p.description, p.stock_status,
        s.shop_id, s.shop_name, s.address, s.latitude, s.longitude,
        (
          6371 * ACOS(
            COS(RADIANS(?)) * COS(RADIANS(s.latitude)) *
            COS(RADIANS(s.longitude) - RADIANS(?)) +
            SIN(RADIANS(?)) * SIN(RADIANS(s.latitude))
          )
        ) AS distance_km
    FROM Products p
    JOIN Shops s ON p.shop_id = s.shop_id
    WHERE p.stock_status = 'in_stock'
    ${categoryFilter}
    HAVING distance_km <= ?
    ORDER BY distance_km ASC
    `,
    params
  );

  res.json({
    success: true,
    count: rows.length,
    data: rows,
  });
});

// GET /api/products/:id (extra convenience route — product detail page)
const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query(
    `SELECT p.*, s.shop_name, s.latitude, s.longitude, s.address
     FROM Products p
     JOIN Shops s ON p.shop_id = s.shop_id
     WHERE p.product_id = ?`,
    [id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  res.json({ success: true, data: rows[0] });
});

// GET /api/products/shop/:shop_id (extra convenience route — a shop's storefront listing)
const getProductsByShop = asyncHandler(async (req, res) => {
  const { shop_id } = req.params;
  const [rows] = await pool.query('SELECT * FROM Products WHERE shop_id = ?', [shop_id]);
  res.json({ success: true, count: rows.length, data: rows });
});

module.exports = { addProduct, getNearbyProducts, getProductById, getProductsByShop };
