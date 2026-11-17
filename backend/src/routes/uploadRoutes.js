const path = require('path');
const express = require('express');
const multer = require('multer');
const { verifyToken, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { saveUpload } = require('../utils/storage');

const router = express.Router();

// Files are buffered in memory, then handed to utils/storage.js, which writes
// them to backend/uploads locally or to R2 when running on Cloudflare.
const storage = multer.memoryStorage();

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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
// Auth: artisan only. Returns a URL the artisan can save as image_url.
router.post(
  '/image',
  verifyToken,
  requireRole('artisan'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file received (expected field "image")' });
    }
    const { name, url } = await saveUpload(req, req.file);
    res.status(201).json({
      success: true,
      message: 'Image uploaded',
      data: { image_url: url, filename: name, size: req.file.size },
    });
  })
);

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
router.post(
  '/media',
  verifyToken,
  requireRole('artisan'),
  mediaUpload.single('media'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file received (expected field "media")' });
    }
    const { url } = await saveUpload(req, req.file);
    res.status(201).json({
      success: true,
      data: { url, media_type: req.file.mimetype.startsWith('video/') ? 'video' : 'image' },
    });
  })
);

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
router.post(
  '/model',
  verifyToken,
  requireRole('artisan'),
  modelUpload.single('model'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file received (expected field "model")' });
    }
    const { url } = await saveUpload(req, req.file);
    res.status(201).json({ success: true, data: { model_url: url } });
  })
);

module.exports = router;
