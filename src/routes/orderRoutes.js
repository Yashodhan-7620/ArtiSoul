const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { createOrder, getMyOrders, getShopOrders, updateOrderStatus } = require('../controllers/ordersController');

// POST   /api/orders            — customer places an order
router.post('/', verifyToken, requireRole('customer'), createOrder);

// GET    /api/orders/mine       — customer sees their purchase history
router.get('/mine', verifyToken, requireRole('customer'), getMyOrders);

// GET    /api/orders/shop       — artisan sees incoming orders on their shop
router.get('/shop', verifyToken, requireRole('artisan'), getShopOrders);

// PATCH  /api/orders/:id/status — artisan marks an order Delivered / Cancelled
router.patch('/:id/status', verifyToken, requireRole('artisan'), updateOrderStatus);

module.exports = router;
