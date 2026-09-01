const express = require('express');
const router = express.Router();
const {
  addProduct,
  getNearbyProducts,
  getProductById,
  getProductsByShop,
} = require('../controllers/productController');
const { verifyToken, requireRole } = require('../middleware/auth');

// Order matters: specific paths before the '/:id' catch-all.
router.get('/nearby', getNearbyProducts);              // public — killer feature
router.get('/shop/:shop_id', getProductsByShop);        // extra convenience
router.get('/:id', getProductById);                     // extra convenience
router.post('/add', verifyToken, requireRole('artisan'), addProduct);

module.exports = router;
