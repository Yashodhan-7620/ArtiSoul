const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const ANGLES = ['front', 'right', 'back', 'left', 'top', 'bottom'];
const isUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);

// Validates the optional 360°/3D/gallery payload shared by add and update.
function parseExtras(body) {
  const enable360 = body.view360_enabled === true || body.view360_enabled === 1;
  const views = body.views && typeof body.views === 'object' ? body.views : {};
  const validViews = ANGLES.filter((a) => isUrl(views[a]));
  if (enable360 && !['front', 'right', 'back', 'left'].every((a) => validViews.includes(a))) {
    return { error: '360° view needs front, right, back and left photos' };
  }
  const model_url =
    typeof body.model_url === 'string' && /^https?:\/\/.+\.glb$/i.test(body.model_url)
      ? body.model_url.slice(0, 500)
      : null;
  const media = (Array.isArray(body.media) ? body.media : [])
    .filter((m) => m && ['image', 'video'].includes(m.media_type) && isUrl(m.url))
    .slice(0, 8);
  return { enable360, views, validViews, model_url, media };
}

async function saveExtras(productId, x) {
  await pool.query('DELETE FROM Product360 WHERE product_id = ?', [productId]);
  await pool.query('DELETE FROM ProductMedia WHERE product_id = ?', [productId]);
  if (x.enable360) {
    await pool.query('INSERT INTO Product360 (product_id, angle, url) VALUES ?', [
      x.validViews.map((a) => [productId, a, x.views[a].slice(0, 500)]),
    ]);
  }
  if (x.media.length) {
    await pool.query('INSERT INTO ProductMedia (product_id, media_type, url, sort_order) VALUES ?', [
      x.media.map((m, i) => [productId, m.media_type, m.url.slice(0, 500), i]),
    ]);
  }
}
// POST /api/products/add
// Auth: artisan only.
// Body: { shop_id, name, price, category, image_url, description, stock_status }
const addProduct = asyncHandler(async (req, res) => {
  const artisan_id = req.user.user_id;
  const { shop_id, name, price, category, image_url, description } = req.body;

  if (!shop_id || !name || price === undefined) {
    return res.status(400).json({ success: false, message: 'shop_id, name and price are required' });
  }

  if (isNaN(price) || Number(price) < 0) {
    return res.status(400).json({ success: false, message: 'price must be a non-negative number' });
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

  const x = parseExtras(req.body);
  if (x.error) return res.status(400).json({ success: false, message: x.error });

  const stock_quantity = Math.max(0, parseInt(req.body.stock_quantity, 10) || 0);

  const [result] = await pool.query(
    `INSERT INTO Products (shop_id, name, price, category, image_url, description, stock_status, stock_quantity, view360_enabled, model_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [shop_id, name, price, category || null, image_url || null, description || null,
     stock_quantity > 0 ? 'in_stock' : 'out_of_stock', stock_quantity, x.enable360 ? 1 : 0, x.model_url]
  );
  await saveExtras(result.insertId, x);

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
      stock_status: stock_quantity > 0 ? 'in_stock' : 'out_of_stock',
      stock_quantity,
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
    `SELECT p.*, s.shop_name, s.artisan_id, s.latitude, s.longitude, s.address
     FROM Products p
     JOIN Shops s ON p.shop_id = s.shop_id
     WHERE p.product_id = ?`,
    [id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const [media] = await pool.query(
    'SELECT media_id, media_type, url FROM ProductMedia WHERE product_id = ? ORDER BY sort_order, media_id',
    [id]
  );

  const views360 = {};
  if (rows[0].view360_enabled) {
    const [v] = await pool.query('SELECT angle, url FROM Product360 WHERE product_id = ?', [id]);
    v.forEach((r) => { views360[r.angle] = r.url; });
  }

  res.json({ success: true, data: { ...rows[0], media, views360 } });
});

// GET /api/products/shop/:shop_id (extra convenience route — a shop's storefront listing)
const getProductsByShop = asyncHandler(async (req, res) => {
  const { shop_id } = req.params;
  const [rows] = await pool.query('SELECT * FROM Products WHERE shop_id = ?', [shop_id]);
  res.json({ success: true, count: rows.length, data: rows });
});

// PUT /api/products/:id  (artisan who owns the shop)
const updateProduct = asyncHandler(async (req, res) => {
  const [[owned]] = await pool.query(
    `SELECT p.product_id FROM Products p JOIN Shops s ON s.shop_id = p.shop_id
     WHERE p.product_id = ? AND s.artisan_id = ?`,
    [req.params.id, req.user.user_id]
  );
  if (!owned) return res.status(404).json({ success: false, message: 'Product not found or not yours' });

  const { name, price, category, image_url, description } = req.body;
  if (!name || !String(name).trim() || price === undefined || isNaN(price) || Number(price) < 0) {
    return res.status(400).json({ success: false, message: 'A name and a valid price are required' });
  }
  const stock_quantity = Number(req.body.stock_quantity);
  if (!Number.isInteger(stock_quantity) || stock_quantity < 0) {
    return res.status(400).json({ success: false, message: 'stock_quantity must be a whole number, 0 or more' });
  }
  const x = parseExtras(req.body);
  if (x.error) return res.status(400).json({ success: false, message: x.error });

  await pool.query(
    `UPDATE Products SET name = ?, price = ?, category = ?, image_url = ?, description = ?,
            stock_quantity = ?, stock_status = ?, view360_enabled = ?, model_url = ?
     WHERE product_id = ?`,
    [String(name).trim(), price, category || null, image_url || null, description || null,
     stock_quantity, stock_quantity > 0 ? 'in_stock' : 'out_of_stock', x.enable360 ? 1 : 0, x.model_url, req.params.id]
  );
  await saveExtras(req.params.id, x);
  res.json({ success: true, message: 'Product updated' });
});

// DELETE /api/products/:id  (artisan who owns the shop)
// Products with orders can't be deleted — that would erase customers' order history.
const deleteProduct = asyncHandler(async (req, res) => {
  const [[owned]] = await pool.query(
    `SELECT p.product_id FROM Products p JOIN Shops s ON s.shop_id = p.shop_id
     WHERE p.product_id = ? AND s.artisan_id = ?`,
    [req.params.id, req.user.user_id]
  );
  if (!owned) return res.status(404).json({ success: false, message: 'Product not found or not yours' });

  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM Orders WHERE product_id = ?', [req.params.id]);
  if (n > 0) {
    return res.status(409).json({
      success: false,
      message: 'This product has orders, so it can\'t be deleted. Set its stock to 0 to hide it instead.',
    });
  }
  await pool.query('DELETE FROM Products WHERE product_id = ?', [req.params.id]);
  res.json({ success: true, message: 'Product deleted' });
});

module.exports = { addProduct, updateProduct, deleteProduct, addProduct, getNearbyProducts, getProductById, getProductsByShop };
