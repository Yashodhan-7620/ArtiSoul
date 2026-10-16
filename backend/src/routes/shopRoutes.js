const express = require('express');
const router = express.Router();
const {
  createShop,
  getMyShops,
  updateShopQr,
  getShopQr,
} = require('../controllers/shopController');
const { verifyToken, requireRole } = require('../middleware/auth');

// extra: artisans need a shop before they can add products
router.post('/create', verifyToken, requireRole('artisan'), createShop);
router.get('/mine', verifyToken, requireRole('artisan'), getMyShops);

// Artisan uploads/updates their UPI QR code
router.put('/my-qr', verifyToken, requireRole('artisan'), updateShopQr);

// Public/Customer route to fetch a shop's UPI QR code during checkout
router.get('/qr/:shopId', getShopQr);

module.exports = router;