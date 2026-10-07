// src/routes/servicerequest_routes.js
// Exports two routers that match the functions in the web app's api/client.js.
const express = require('express');
const multer = require('multer');
const controller = require('../controllers/servicerequest_controllers');
const Provider = require('../models/provider_model');
const asyncHandler = require('../utils/async_handler');
const ApiError = require('../utils/api_error');
const { authenticate } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // one photo, 5 MB, same as the provider documents
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

// Provider endpoints are only for users who have a service provider profile.
const requireProvider = asyncHandler(async (req, res, next) => {
  const provider = await Provider.findByUserId(req.user.user_id);
  if (!provider) throw new ApiError(403, 'Only service providers can do this');
  next();
});

// ----- customer: mounted at /api/service-requests -----
const customer = express.Router();
customer.post('/', authenticate, uploadPhoto, controller.create);
customer.get('/', authenticate, controller.listMine);
// Mobile create-request flow: the photo and the AI diagnosis happen BEFORE the request
// row exists (it is created on submit), so these take no :requestId.
customer.post('/photos', authenticate, uploadPhoto, controller.uploadPhoto);
customer.post('/diagnose', authenticate, controller.diagnoseDraft);
customer.get('/:requestId', authenticate, controller.getOne);
customer.post('/:requestId/ai-diagnosis', authenticate, controller.aiDiagnosis);
customer.post('/:requestId/skip-ai', authenticate, controller.skipAi);
customer.post('/:requestId/resolve', authenticate, controller.resolve);
customer.get('/:requestId/providers', authenticate, controller.recommendedProviders);
customer.post('/:requestId/submit', authenticate, controller.submit);

// ----- service provider: mounted at /api/providers/requests -----
const provider = express.Router();
provider.get('/', authenticate, requireProvider, controller.listIncoming);
provider.get('/:requestId', authenticate, requireProvider, controller.getIncoming);
provider.post('/:requestId/quote', authenticate, requireProvider, controller.sendQuote);
provider.post('/:requestId/reject', authenticate, requireProvider, controller.rejectRequest);

module.exports = { customer, provider };

// Wired up in src/routes/api_routes.js (/api/service-requests -> customer)
// and src/routes/provider_routes.js (/api/providers/requests -> provider).