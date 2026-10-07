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

// The workflow endpoints (tracking, quotation answers, payments, ratings) live in
// workflow_controllers.js and use the tables from migrations/002_core_workflow_tables.sql.
const workflow = require('../controllers/workflow_controllers');

// ----- customer: mounted at /api/service-requests -----
const customer = express.Router();
customer.post('/', authenticate, uploadPhoto, controller.create);
customer.get('/', authenticate, controller.listMine);
// Static paths must come before '/:requestId' — 'active'/'tracking' would
// otherwise be parsed as a request id (and 400 on parseRequestId).
customer.get('/active', authenticate, workflow.getActiveRepair);
customer.get('/tracking', authenticate, workflow.getTracking);
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
// Customer answers to provider-initiated actions (Track screen) + payment/rating.
customer.post('/:requestId/schedule-proposals/:proposalId/accept', authenticate, workflow.answerScheduleProposal('accepted'));
customer.post('/:requestId/schedule-proposals/:proposalId/reject', authenticate, workflow.answerScheduleProposal('rejected'));
customer.post('/:requestId/payment-requests/:paymentRequestId/approve', authenticate, workflow.answerPaymentRequest('approved'));
customer.post('/:requestId/payment-requests/:paymentRequestId/reject', authenticate, workflow.answerPaymentRequest('rejected'));
customer.post('/:requestId/quotation/respond', authenticate, workflow.respondToQuotation);
customer.post('/:requestId/payment', authenticate, workflow.payForRequest);
customer.post('/:requestId/rating', authenticate, workflow.rateRequest);

// ----- service provider: mounted at /api/providers/requests AND /api/provider/service-requests -----
const provider = express.Router();
provider.get('/', authenticate, requireProvider, controller.listIncoming);
provider.get('/:requestId', authenticate, requireProvider, controller.getIncoming);
provider.post('/:requestId/quote', authenticate, requireProvider, controller.sendQuote);
provider.post('/:requestId/reject', authenticate, requireProvider, controller.rejectRequest);
// The mobile app's provider screens call these paths (api/servicerequest_api.js).
provider.post('/:requestId/accept', authenticate, requireProvider, workflow.acceptRequest);
provider.post('/:requestId/decline', authenticate, requireProvider, workflow.declineRequest);
provider.post('/:requestId/quotation', authenticate, requireProvider, workflow.sendQuotation);
provider.post('/:requestId/schedule-proposals', authenticate, requireProvider, workflow.proposeSchedule);
provider.post('/:requestId/payment-requests', authenticate, requireProvider, workflow.requestAdditionalPayment);
provider.post('/:requestId/progress', authenticate, requireProvider, workflow.updateJobProgress);
provider.post('/:requestId/complete', authenticate, requireProvider, workflow.completeJob);

module.exports = { customer, provider };

// Wired up in src/routes/api_routes.js (/api/service-requests -> customer)
// and src/routes/provider_routes.js (/api/providers/requests -> provider).