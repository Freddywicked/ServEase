// src/routes/providerwork_routes.js
// The provider's Jobs / Dashboard / Earnings endpoints the mobile app calls
// (api/providerWork_api.js + api/servicerequest_api.js). Mounted at /api/provider
// in api_routes.js — alongside /api/provider/service-requests (the inbox, which
// lives in servicerequest_routes.js).
const express = require('express');
const multer = require('multer');
const workflow = require('../controllers/workflow_controllers');
const Provider = require('../models/provider_model');
const asyncHandler = require('../utils/async_handler');
const ApiError = require('../utils/api_error');
const { authenticate } = require('../middleware/auth');

// The status update can carry one photo (same 5 MB image rules as request photos).
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

const uploadPhoto = (req, res, next) =>
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    err.status = err.status || 400;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = 'The photo must be 5 MB or smaller.';
    return next(err);
  });

// These routes are only for users who have a service provider profile.
const requireProvider = asyncHandler(async (req, res, next) => {
  const provider = await Provider.findByUserId(req.user.user_id);
  if (!provider) throw new ApiError(403, 'Only service providers can do this');
  next();
});

const router = express.Router();
router.use(authenticate, requireProvider);

router.get('/dashboard', workflow.getProviderDashboard);
router.get('/jobs', workflow.listJobs);
router.get('/jobs/:jobId', workflow.getJob);
router.patch('/jobs/:jobId/status', uploadPhoto, workflow.updateJobStatus);
router.post('/jobs/:jobId/additional-parts', workflow.notifyAdditionalParts);
router.get('/earnings', workflow.getEarnings);

module.exports = router;
