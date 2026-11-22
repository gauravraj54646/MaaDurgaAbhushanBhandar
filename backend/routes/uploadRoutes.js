const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB max (the frontend already shrinks it)
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG or WEBP images are allowed.'));
    }
  },
});

// Wrap multer so its errors come back as clean JSON
const handleUpload = (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
};

// POST /api/uploads/bill-photo
router.post('/bill-photo', protect, admin, handleUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No photo received.' });
    }

    // Server-side safety net: rotate by EXIF, cap size, recompress
    const buffer = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer();

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: 'bills', resource_type: 'image' }, (err, r) =>
          err ? reject(err) : resolve(r)
        )
        .end(buffer);
    });

    res.status(201).json({ url: result.secure_url, publicId: result.public_id });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Upload failed.' });
  }
});

// DELETE /api/uploads/bill-photo   body: { publicId }
router.delete('/bill-photo', protect, admin, async (req, res) => {
  try {
    const { publicId } = req.body;

    // Only allow deleting files inside our "bills" folder
    if (!publicId || typeof publicId !== 'string' || !publicId.startsWith('bills/')) {
      return res.status(400).json({ message: 'Invalid publicId.' });
    }

    await cloudinary.uploader.destroy(publicId);
    res.json({ message: 'Photo deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;