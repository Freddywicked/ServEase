const router = require('express').Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const provider = require('../controllers/provider_controllers');

// Files are kept in memory and streamed straight to Supabase Storage —
// never written to disk on the server.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});

// GET /api/providers/me — the logged-in user's provider profile (any status).
router.get('/me', authenticate, provider.me);

router.post(
  '/apply',
  authenticate,
  upload.fields([
    { name: 'validId', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'supportingDocs', maxCount: 5 }, // was 1 — the screen's document picker allows selecting several
  ]),
  provider.apply
);

module.exports = router;