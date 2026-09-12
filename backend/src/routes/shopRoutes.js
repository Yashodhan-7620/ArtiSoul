const express = require('express');
const router = express.Router();
const { createShop, getMyShops } = require('../controllers/shopController');
const { verifyToken, requireRole } = require('../middleware/auth');

// extra: artisans need a shop before they can add products
router.post('/create', verifyToken, requireRole('artisan'), createShop);
router.get('/mine', verifyToken, requireRole('artisan'), getMyShops);

module.exports = router;
