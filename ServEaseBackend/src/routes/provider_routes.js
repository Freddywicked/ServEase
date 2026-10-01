const router = require('express').Router();
const multer = require('multer');
const providers = require('../controllers/provider_controllers');
const { authenticate } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB, same as the form
});

router.post(
  '/application',
  authenticate,
  upload.fields([
    { name: 'validId', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'supportingDocs', maxCount: 5 },
  ]),
  providers.submitApplication
);

module.exports = router;