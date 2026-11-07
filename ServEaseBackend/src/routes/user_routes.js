const router = require('express').Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const users = require('../controllers/user_controllers');

// One profile photo, 5 MB, images only — same rules as the service-request photo.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      const error = new Error('Only image files are allowed.');
      error.status = 400;
      return cb(error);
    }
    return cb(null, true);
  },
});

// Runs multer and turns its errors into clean 400 responses.
const uploadPhoto = (req, res, next) =>
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    err.status = err.status || 400;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = 'The photo must be 5 MB or smaller.';
    return next(err);
  });

// PATCH /api/users/me — body: any of { email, address, activeMode, prefersHomeService, searchRadiusKm }
router.patch('/me', authenticate, users.updateMe);

// POST /api/users/me/photo — multipart, field "photo" -> { photoUrl }
router.post('/me/photo', authenticate, uploadPhoto, users.uploadMyPhoto);

module.exports = router;