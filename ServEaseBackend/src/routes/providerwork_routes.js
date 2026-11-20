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

// The status update can carry up to 5 photos and / or videos (field "attachments"); the old
// single "photo" field is still accepted. Photos are limited to 5 MB, videos to 50 MB.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    const isMedia = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    if (!['attachments', 'photo'].includes(file.fieldname) || !isMedia) {
      const error = new Error('Attach photos or videos only.');
      error.status = 400;
      return cb(error);
    }
    return cb(null, true);
  },
});

const uploadAttachments = (req, res, next) =>
  upload.fields([
    { name: 'attachments', maxCount: 5 },
    { name: 'photo', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      err.status = err.status || 400;
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Videos must be 50 MB or smaller.';
      if (err.code === 'LIMIT_UNEXPECTED_FILE') err.message = 'You can attach up to 5 photos or videos.';
      return next(err);
    }
    const files = Object.values(req.files || {}).flat();
    if (files.some((f) => f.mimetype.startsWith('image/') && f.size > MAX_IMAGE_BYTES)) {
      return next(new ApiError(400, 'Each photo must be 5 MB or smaller.'));
    }
    return next();
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
// Static path BEFORE '/jobs/:jobId', otherwise "quotations" is read as a job id.
router.get('/jobs/quotations', workflow.listJobQuotations);
router.get('/jobs/:jobId', workflow.getJob);
router.patch('/jobs/:jobId/status', uploadAttachments, workflow.updateJobStatus);
router.post('/jobs/:jobId/additional-parts', workflow.notifyAdditionalParts);
// Price negotiation from the customer (Active Jobs > Quotation).
router.post(
  '/jobs/:jobId/payment-requests/:paymentRequestId/negotiation/accept',
  workflow.answerJobNegotiation('accepted')
);
router.post(
  '/jobs/:jobId/payment-requests/:paymentRequestId/negotiation/reject',
  workflow.answerJobNegotiation('rejected')
);
router.get('/earnings', workflow.getEarnings);
// Nav bar badges on the mobile Requests and Jobs tabs.
router.get('/badge-counts', workflow.getProviderBadgeCounts);
router.post('/badge-counts/seen', workflow.markProviderBadgeSeen);

module.exports = router;