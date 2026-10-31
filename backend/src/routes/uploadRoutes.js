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

const MEDIA_ALLOWED = [...ALLOWED, 'video/mp4', 'video/webm'];
const mediaUpload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB (short clips)
  fileFilter: (req, file, cb) => {
    if (!MEDIA_ALLOWED.includes(file.mimetype)) {
      return cb(Object.assign(new Error('Only images or MP4/WEBM videos are allowed'), { status: 400 }));
    }
    cb(null, true);
  },
});

// POST /api/uploads/media  (multipart/form-data, field name: "media")
router.post('/media', verifyToken, requireRole('artisan'), mediaUpload.single('media'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file received (expected field "media")' });
  }
  res.status(201).json({
    success: true,
    data: {
      url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,
      media_type: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
    },
  });
});

const modelUpload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.glb') {
      return cb(Object.assign(new Error('Only .glb 3D models are allowed'), { status: 400 }));
    }
    cb(null, true);
  },
});

// POST /api/uploads/model  (multipart/form-data, field name: "model")
router.post('/model', verifyToken, requireRole('artisan'), modelUpload.single('model'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file received (expected field "model")' });
  }
  res.status(201).json({
    success: true,
    data: { model_url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` },
  });
});

module.exports = router;
