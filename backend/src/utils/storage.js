const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { cfEnv, isWorker } = require('../config/runtime');

// Where uploaded files live:
// - Node (local dev): backend/uploads on disk, served by express.static.
// - Cloudflare Workers: the R2 bucket bound as UPLOADS (no persistent disk).
const UPLOAD_DIR = isWorker ? null : path.join(__dirname, '..', '..', 'uploads');
if (!isWorker) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function bucket() {
  const b = cfEnv().UPLOADS;
  if (!b) throw new Error('UPLOADS R2 binding is missing — check wrangler.jsonc');
  return b;
}

// Saves a multer memory-storage file and returns the public URL for it.
async function saveUpload(req, file) {
  // Random name so two artisans uploading "saree.jpg" don't overwrite each other.
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

  if (isWorker) {
    await bucket().put(name, file.buffer, {
      httpMetadata: { contentType: contentTypeFor(name, file.mimetype) },
    });
    // Same origin as the app, so a relative link works on every device.
    return { name, url: `/uploads/${name}` };
  }

  await fs.promises.writeFile(path.join(UPLOAD_DIR, name), file.buffer);
  return { name, url: `${req.protocol}://${req.get('host')}/uploads/${name}` };
}

function contentTypeFor(name, fallback) {
  if (name.endsWith('.glb')) return 'model/gltf-binary';
  return fallback || 'application/octet-stream';
}

// GET /uploads/:name on Workers — streams the object out of R2, with Range
// support so videos can seek.
async function serveFromR2(req, res) {
  const name = req.params.name;
  if (!/^[\w.-]+$/.test(name)) return res.status(400).end();

  const rangeHeader = req.get('range');
  const m = rangeHeader && /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  let range;
  if (m && (m[1] || m[2])) {
    range = m[1]
      ? { offset: Number(m[1]), ...(m[2] ? { length: Number(m[2]) - Number(m[1]) + 1 } : {}) }
      : { suffix: Number(m[2]) };
  }

  const obj = await bucket().get(name, range ? { range } : undefined);
  if (!obj) return res.status(404).json({ success: false, message: 'File not found' });

  const body = Buffer.from(await obj.arrayBuffer());
  res.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('Accept-Ranges', 'bytes');
  res.set('ETag', obj.httpEtag);

  if (range && obj.range) {
    const start = obj.range.offset ?? obj.size - obj.range.suffix;
    const end = start + body.length - 1;
    res.status(206).set('Content-Range', `bytes ${start}-${end}/${obj.size}`);
  }
  res.send(body);
}

module.exports = { UPLOAD_DIR, saveUpload, serveFromR2 };
