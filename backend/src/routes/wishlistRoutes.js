const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const w = require('../controllers/wishlistController');

router.use(verifyToken, requireRole('customer'));
router.get('/', w.listWishlists);
router.post('/', w.createWishlist);
router.patch('/:id', w.renameWishlist);
router.delete('/:id', w.deleteWishlist);
router.post('/:id/items', w.addWishlistItem);
router.delete('/:id/items/:productId', w.removeWishlistItem);

module.exports = router;
