const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const a = require('../controllers/adminController');

// Every admin route: valid token + an *active* account whose role in the
// database is 'admin' (see middleware/auth.js).
router.use(verifyToken, requireRole('admin'));
router.get('/overview', a.overview);
router.get('/activity', a.activity);
router.get('/users', a.users);
router.patch('/users/:id/status', a.setUserStatus);
router.get('/orders', a.orders);
router.get('/reviews', a.reviews);
router.delete('/reviews/:id', a.removeReview);

module.exports = router;
