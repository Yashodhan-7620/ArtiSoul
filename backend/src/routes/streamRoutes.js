const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  startStream,
  updateOffer,
  getStreamState,
  postAnswer,
  rejoin,
  endStream,
} = require('../controllers/streamController');

// Private per-order livestreams (artisan -> the order's customer only).
router.use(verifyToken);

router.get('/:orderId', getStreamState);
router.post('/:orderId/start', requireRole('artisan'), startStream);
router.put('/:orderId/offer', requireRole('artisan'), updateOffer);
router.post('/:orderId/end', requireRole('artisan'), endStream);
router.post('/:orderId/answer', requireRole('customer'), postAnswer);
router.post('/:orderId/rejoin', requireRole('customer'), rejoin);

module.exports = router;
