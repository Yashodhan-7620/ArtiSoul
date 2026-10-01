const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Product photos live on disk under /uploads and are served statically by app.js.
// Good enough for the MVP — swapping in S3/Cloudinary later only changes this file.
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Random name so two artisans uploading "saree.jpg" don't overwrite each other.
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(Object.assign(new Error('Only JPG, PNG, WEBP or GIF images are allowed'), { status: 400 }));
    }
    cb(null, true);
  },
});

// POST /api/uploads/image  (multipart/form-data, field name: "image")
// Auth: artisan only. Returns an absolute URL the artisan can save as image_url.
router.post('/image', verifyToken, requireRole('artisan'), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file received (expected field "image")' });
  }

  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(201).json({
    success: true,
    message: 'Image uploaded',
    data: { image_url: url, filename: req.file.filename, size: req.file.size },
  });
});

module.exports = router;
