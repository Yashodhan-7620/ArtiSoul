const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { audit } = require('../utils/audit');
const { artisanStats } = require('../utils/ranks');

const ANGLES = ['front', 'right', 'back', 'left', 'top', 'bottom'];
const isUrl = (u) => typeof u === 'string' && /^(https?:\/\/|\/uploads\/)/.test(u);

// Validates the optional 360°/3D/gallery payload shared by add and update.
function parseExtras(body) {
  const enable360 = body.view360_enabled === true || body.view360_enabled === 1;
  const views = body.views && typeof body.views === 'object' ? body.views : {};
  const validViews = ANGLES.filter((a) => isUrl(views[a]));
  if (enable360 && !['front', 'right', 'back', 'left'].every((a) => validViews.includes(a))) {
    return { error: '360° view needs front, right, back and left photos' };
  }
  const model_url =
    typeof body.model_url === 'string' && /^(https?:\/\/|\/uploads\/).+\.glb$/i.test(body.model_url)
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
  await audit(req, 'product.create', { entity: 'product', entityId: result.insertId });

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
        COALESCE(rv.avg_rating, 0) AS avg_rating, COALESCE(rv.review_count, 0) AS review_count,
        lr.comment AS latest_review, lr.reviewer AS latest_reviewer, lr.rating AS latest_review_rating,
        (
          6371 * ACOS(
            COS(RADIANS(?)) * COS(RADIANS(s.latitude)) *
            COS(RADIANS(s.longitude) - RADIANS(?)) +
            SIN(RADIANS(?)) * SIN(RADIANS(s.latitude))
          )
        ) AS distance_km
    FROM Products p
    JOIN Shops s ON p.shop_id = s.shop_id
    -- Buyer reviews: average + count, and the newest written review for the card
    LEFT JOIN (
      SELECT product_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
      FROM Reviews GROUP BY product_id
    ) rv ON rv.product_id = p.product_id
    LEFT JOIN (
      SELECT r.product_id, r.rating, r.comment, SUBSTRING_INDEX(u.name, ' ', 1) AS reviewer
      FROM Reviews r JOIN Users u ON u.user_id = r.customer_id
      WHERE r.comment IS NOT NULL
        AND r.review_id = (SELECT r2.review_id FROM Reviews r2
                           WHERE r2.product_id = r.product_id AND r2.comment IS NOT NULL
                           ORDER BY r2.created_at DESC, r2.review_id DESC LIMIT 1)
    ) lr ON lr.product_id = p.product_id
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
    `SELECT p.*, s.shop_name, s.artisan_id, s.latitude, s.longitude, s.address, s.image_url AS shop_image_url
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

  // Buyer reviews are public; only the reviewer's first name is shown.
  const [reviews] = await pool.query(
    `SELECT r.review_id, r.rating, r.comment, r.created_at, SUBSTRING_INDEX(u.name, ' ', 1) AS reviewer
     FROM Reviews r JOIN Users u ON u.user_id = r.customer_id
     WHERE r.product_id = ?
     ORDER BY r.created_at DESC, r.review_id DESC`,
    [id]
  );
  const review_count = reviews.length;
  const avg_rating = review_count
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / review_count) * 10) / 10
    : 0;

  const [maker] = await artisanStats([rows[0].artisan_id]);
  const artisan_rank = maker?.rank || 'none';

  res.json({ success: true, data: { ...rows[0], media, views360, reviews, review_count, avg_rating, artisan_rank } });
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
  await audit(req, 'product.update', { entity: 'product', entityId: req.params.id, details: { stock_quantity } });
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
  await audit(req, 'product.delete', { entity: 'product', entityId: req.params.id });
  res.json({ success: true, message: 'Product deleted' });
});

// GET /api/products/recommended?lat=&lng=&radius=25&product_id=
// Public; personalised when a buyer is logged in. A transparent scoring
// model (no AI call, so it is free and instant):
//   + what the buyer bought / carted / wishlisted (category affinity)
//   + similar pieces when shown on a product page (same category)
//   + rating, sales and newness, - distance
// Each result carries a `reason` the app shows ("Because you like Pottery").
const getRecommended = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const radius = Math.min(Math.max(Number(req.query.radius) || 25, 1), 100);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  const contextId = Number(req.query.product_id) || null;

  const distanceSql = hasCoords
    ? `(6371 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(s.latitude)) * COS(RADIANS(s.longitude) - RADIANS(?))
        + SIN(RADIANS(?)) * SIN(RADIANS(s.latitude)))))`
    : 'NULL';
  const [candidates] = await pool.query(
    `SELECT p.product_id, p.name, p.price, p.category, p.image_url, p.stock_status, p.stock_quantity, p.created_at,
            s.shop_id, s.shop_name, ${distanceSql} AS distance_km,
            COALESCE(rv.avg_rating, 0) AS avg_rating, COALESCE(rv.review_count, 0) AS review_count,
            COALESCE(sl.sold, 0) AS sold
     FROM Products p
     JOIN Shops s ON s.shop_id = p.shop_id
     LEFT JOIN (SELECT product_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count FROM Reviews GROUP BY product_id) rv
       ON rv.product_id = p.product_id
     LEFT JOIN (SELECT product_id, SUM(quantity) AS sold FROM Orders WHERE status <> 'Cancelled' GROUP BY product_id) sl
       ON sl.product_id = p.product_id
     WHERE p.stock_status = 'in_stock' AND p.stock_quantity > 0
     ${hasCoords ? 'HAVING distance_km <= ?' : ''}`,
    hasCoords ? [lat, lng, lat, radius] : []
  );

  // Category affinity from the buyer's own activity.
  const affinity = {};
  const exclude = new Set(contextId ? [contextId] : []);
  if (req.user?.role === 'customer') {
    const [signals] = await pool.query(
      `SELECT p.product_id, p.category, 3 AS weight, 1 AS owned FROM Orders o JOIN Products p ON p.product_id = o.product_id
         WHERE o.customer_id = ? AND o.status <> 'Cancelled'
       UNION ALL
       SELECT p.product_id, p.category, 2, 1 FROM CartItems c JOIN Products p ON p.product_id = c.product_id
         WHERE c.user_id = ?
       UNION ALL
       SELECT p.product_id, p.category, 2, 0 FROM WishlistItems wi JOIN Wishlists w ON w.wishlist_id = wi.wishlist_id
         JOIN Products p ON p.product_id = wi.product_id WHERE w.user_id = ?`,
      [req.user.user_id, req.user.user_id, req.user.user_id]
    );
    for (const sig of signals) {
      if (sig.category) affinity[sig.category] = (affinity[sig.category] || 0) + sig.weight;
      if (sig.owned) exclude.add(sig.product_id); // already bought or in the cart
    }
  }
  const maxAffinity = Math.max(1, ...Object.values(affinity));
  let contextCategory = null;
  if (contextId) {
    const [[ctx]] = await pool.query('SELECT category FROM Products WHERE product_id = ?', [contextId]);
    contextCategory = ctx?.category || null;
  }

  const now = Date.now();
  const scored = candidates
    .filter((p) => !exclude.has(p.product_id))
    .map((p) => {
      const aff = p.category ? (affinity[p.category] || 0) / maxAffinity : 0;
      const similar = contextCategory && p.category === contextCategory ? 1 : 0;
      const isNew = now - new Date(p.created_at).getTime() < 30 * 86_400_000;
      const score =
        3 * aff +
        2.5 * similar +
        0.6 * Number(p.avg_rating) +
        0.8 * Math.log1p(Number(p.sold)) +
        (isNew ? 0.5 : 0) -
        (p.distance_km != null ? 0.02 * Number(p.distance_km) : 0);
      let reason = { type: 'popular' };
      if (similar) reason = { type: 'similar', category: p.category };
      else if (aff > 0) reason = { type: 'because_category', category: p.category };
      else if (Number(p.avg_rating) >= 4) reason = { type: 'top_rated' };
      else if (!Number(p.sold) && isNew) reason = { type: 'new' };
      return { ...p, avg_rating: Math.round(Number(p.avg_rating) * 10) / 10, score, reason };
    })
    .sort((a, b) => b.score - a.score || a.product_id - b.product_id)
    .slice(0, limit)
    .map(({ score, created_at, ...rest }) => rest);

  res.json({ success: true, data: scored });
});

module.exports = {
  addProduct,
  updateProduct,
  deleteProduct,
  getNearbyProducts,
  getProductById,
  getProductsByShop,
  getRecommended,
};
