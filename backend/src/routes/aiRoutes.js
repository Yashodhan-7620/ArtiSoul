const express = require('express');
const multer = require('multer');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { suggestListing, aiStatus } = require('../controllers/aiController');

// The photo is only held in memory for the request; it is not stored.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return cb(Object.assign(new Error('Only JPG, PNG, WEBP or GIF images are allowed'), { status: 400 }));
    }
    cb(null, true);
  },
});

router.get('/status', verifyToken, requireRole('artisan'), aiStatus);
router.post('/listing', verifyToken, requireRole('artisan'), upload.single('image'), suggestListing);

module.exports = router;
