const router = require('express').Router();
const multer = require('multer');
const providers = require('../controllers/provider_controllers');
const { authenticate } = require('../middleware/auth');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per image, same as the form

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 7 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      const error = new Error('Only image files are allowed.');
      error.status = 400;
      return cb(error);
    }
    return cb(null, true);
  },
});

// Runs multer, and turns its errors into clean 400 responses.
const uploadFields = (req, res, next) =>
  upload.fields([
    { name: 'validId', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'supportingDocs', maxCount: 5 },
  ])(req, res, (err) => {
    if (!err) return next();
    err.status = err.status || 400;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Each image must be 5 MB or smaller.';
    return next(err);
  });

router.post('/application', authenticate, uploadFields, providers.submitApplication);

module.exports = router;