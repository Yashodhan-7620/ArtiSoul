const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { checkout, verifyPayment } = require('../controllers/checkoutController');
const { createReview } = require('../controllers/reviewController');
const { createOrder, getMyOrders, getShopOrders, updateOrderStatus } = require('../controllers/ordersController');

// POST   /api/orders            — customer places an order
router.post('/', verifyToken, requireRole('customer'), createOrder);

router.post('/checkout', verifyToken, requireRole('customer'), checkout);
router.post('/verify-payment', verifyToken, requireRole('customer'), verifyPayment);

// GET    /api/orders/mine       — customer sees their purchase history
router.get('/mine', verifyToken, requireRole('customer'), getMyOrders);

// POST   /api/orders/:id/review — customer reviews a delivered order (once, final)
router.post('/:id/review', verifyToken, requireRole('customer'), createReview);

// GET    /api/orders/shop       — artisan sees incoming orders on their shop
router.get('/shop', verifyToken, requireRole('artisan'), getShopOrders);

// PATCH  /api/orders/:id/status — artisan accepts an order or marks it Delivered / Cancelled
router.patch('/:id/status', verifyToken, requireRole('artisan'), updateOrderStatus);

module.exports = router;
