const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth, requireRole } = require('../middleware/auth');
const ev = require('../controllers/eventController');

router.get('/venues', ev.listVenues);
router.get('/', optionalAuth, ev.listEvents);
router.post('/', verifyToken, requireRole('artisan', 'admin'), ev.createEvent);
router.post('/:id/respond', verifyToken, requireRole('artisan'), ev.respond);
router.post('/:id/approve', verifyToken, requireRole('admin'), ev.approveEvent);
router.post('/:id/reject', verifyToken, requireRole('admin'), ev.rejectEvent);

module.exports = router;
