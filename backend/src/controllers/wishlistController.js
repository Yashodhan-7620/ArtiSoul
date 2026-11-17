const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { audit } = require('../utils/audit');

// Each buyer can keep at most two named wishlists ("sections").
const MAX_WISHLISTS = 2;
const MAX_ITEMS = 100;

function cleanName(name) {
  const n = String(name ?? '').trim().replace(/\s+/g, ' ');
  return n.length >= 1 && n.length <= 40 ? n : null;
}

async function ownWishlist(wishlistId, userId) {
  const [[w]] = await pool.query('SELECT wishlist_id, name FROM Wishlists WHERE wishlist_id = ? AND user_id = ?', [
    wishlistId,
    userId,
  ]);
  return w;
}

// GET /api/wishlists  - both sections with their items.
const listWishlists = asyncHandler(async (req, res) => {
  const [lists] = await pool.query(
    'SELECT wishlist_id, name, created_at FROM Wishlists WHERE user_id = ? ORDER BY created_at, wishlist_id',
    [req.user.user_id]
  );
  const [items] = lists.length
    ? await pool.query(
        `SELECT wi.wishlist_id, wi.added_at, p.product_id, p.name, p.price, p.image_url, p.stock_quantity,
                p.stock_status, p.category, s.shop_name
         FROM WishlistItems wi
         JOIN Products p ON p.product_id = wi.product_id
         JOIN Shops s ON s.shop_id = p.shop_id
         WHERE wi.wishlist_id IN (?) ORDER BY wi.added_at DESC`,
        [lists.map((l) => l.wishlist_id)]
      )
    : [[]];
  res.json({
    success: true,
    data: {
      max: MAX_WISHLISTS,
      lists: lists.map((l) => ({ ...l, items: items.filter((i) => i.wishlist_id === l.wishlist_id) })),
    },
  });
});

// POST /api/wishlists   Body: { name }
const createWishlist = asyncHandler(async (req, res) => {
  const name = cleanName(req.body.name);
  if (!name) return res.status(400).json({ success: false, message: 'Name must be 1 to 40 characters' });
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM Wishlists WHERE user_id = ?', [req.user.user_id]);
  if (n >= MAX_WISHLISTS) {
    return res.status(409).json({ success: false, message: `You can have at most ${MAX_WISHLISTS} wishlists` });
  }
  const [r] = await pool.query('INSERT INTO Wishlists (user_id, name) VALUES (?, ?)', [req.user.user_id, name]);
  await audit(req, 'wishlist.create', { entity: 'wishlist', entityId: r.insertId });
  res.status(201).json({ success: true, data: { wishlist_id: r.insertId, name, items: [] } });
});

// PATCH /api/wishlists/:id   Body: { name }
const renameWishlist = asyncHandler(async (req, res) => {
  const name = cleanName(req.body.name);
  if (!name) return res.status(400).json({ success: false, message: 'Name must be 1 to 40 characters' });
  const w = await ownWishlist(req.params.id, req.user.user_id);
  if (!w) return res.status(404).json({ success: false, message: 'Wishlist not found' });
  await pool.query('UPDATE Wishlists SET name = ? WHERE wishlist_id = ?', [name, w.wishlist_id]);
  res.json({ success: true, data: { wishlist_id: w.wishlist_id, name } });
});

// DELETE /api/wishlists/:id
const deleteWishlist = asyncHandler(async (req, res) => {
  const w = await ownWishlist(req.params.id, req.user.user_id);
  if (!w) return res.status(404).json({ success: false, message: 'Wishlist not found' });
  await pool.query('DELETE FROM Wishlists WHERE wishlist_id = ?', [w.wishlist_id]);
  await audit(req, 'wishlist.delete', { entity: 'wishlist', entityId: w.wishlist_id });
  res.json({ success: true });
});

// POST /api/wishlists/:id/items   Body: { product_id }
const addWishlistItem = asyncHandler(async (req, res) => {
  const w = await ownWishlist(req.params.id, req.user.user_id);
  if (!w) return res.status(404).json({ success: false, message: 'Wishlist not found' });
  const [[p]] = await pool.query('SELECT product_id FROM Products WHERE product_id = ?', [req.body.product_id]);
  if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM WishlistItems WHERE wishlist_id = ?', [w.wishlist_id]);
  if (n >= MAX_ITEMS) return res.status(409).json({ success: false, message: 'This wishlist is full' });
  await pool.query('INSERT IGNORE INTO WishlistItems (wishlist_id, product_id) VALUES (?, ?)', [w.wishlist_id, p.product_id]);
  res.status(201).json({ success: true, data: { wishlist_id: w.wishlist_id, product_id: p.product_id } });
});

// DELETE /api/wishlists/:id/items/:productId
const removeWishlistItem = asyncHandler(async (req, res) => {
  const w = await ownWishlist(req.params.id, req.user.user_id);
  if (!w) return res.status(404).json({ success: false, message: 'Wishlist not found' });
  await pool.query('DELETE FROM WishlistItems WHERE wishlist_id = ? AND product_id = ?', [w.wishlist_id, req.params.productId]);
  res.json({ success: true });
});

module.exports = {
  listWishlists,
  createWishlist,
  renameWishlist,
  deleteWishlist,
  addWishlistItem,
  removeWishlistItem,
  MAX_WISHLISTS,
};
