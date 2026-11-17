const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { listRanks, myRank } = require('../controllers/eventController');

router.get('/', listRanks);
router.get('/me', verifyToken, requireRole('artisan'), myRank);

module.exports = router;
