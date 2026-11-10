const express = require('express');
const router = express.Router();
const {
  addProduct,
  updateProduct,
  deleteProduct,
  getNearbyProducts,
  getProductById,
  getProductsByShop,
} = require('../controllers/productController');
const { verifyToken, requireRole } = require('../middleware/auth');

// Order matters: specific paths before the '/:id' catch-all.
router.get('/nearby', getNearbyProducts);              // public â€” killer feature
router.get('/shop/:shop_id', getProductsByShop);        // extra convenience
router.get('/:id', getProductById);                     // extra convenience
router.post('/add', verifyToken, requireRole('artisan'), addProduct);
router.put('/:id', verifyToken, requireRole('artisan'), updateProduct);
router.delete('/:id', verifyToken, requireRole('artisan'), deleteProduct);

module.exports = router;
