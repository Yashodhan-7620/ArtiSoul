const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { listNotifications, unreadCount, markRead } = require('../controllers/notificationController');

router.use(verifyToken);
router.get('/', listNotifications);
router.get('/unread-count', unreadCount);
router.post('/read', markRead);

module.exports = router;
