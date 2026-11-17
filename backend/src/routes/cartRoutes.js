const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { getCart, addToCart, updateCartItem, removeCartItem } = require('../controllers/cartController');

router.use(verifyToken, requireRole('customer'));
router.get('/', getCart);
router.post('/', addToCart);
router.put('/:productId', updateCartItem);
router.delete('/:productId', removeCartItem);

module.exports = router;
