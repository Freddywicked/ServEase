const router = require('express').Router();
const { supabase } = require('../config/supabase');
const workflow = require('../controllers/workflow_controllers');

// Quick check that the server AND the Supabase connection/keys work.
router.get('/health', async (req, res) => {
  const { error } = await supabase.from('users').select('user_id', { count: 'exact', head: true });
  if (error) console.error('[health] Supabase error:', error.message);
  res.status(error ? 503 : 200).json({
    status: error ? 'degraded' : 'ok',
    database: error ? 'unreachable' : 'connected',
  });
});

router.use('/auth', require('./auth_routes'));
router.use('/providers', require('./provider_routes'));
router.use('/users', require('./user_routes'));
// Customer side of the service request flow; the provider side is mounted
// inside provider_routes.js at /api/providers/requests.
router.use('/service-requests', require('./servicerequest_routes').customer);

// Reference data + helpers for the create-request flow (used by the mobile app's step 1).
const serviceRequestController = require('../controllers/servicerequest_controllers');
const { authenticate } = require('../middleware/auth');
router.get('/categories', serviceRequestController.listCategories);
router.get('/appointment-time-slots', serviceRequestController.listTimeSlots);
// Authenticated: it proxies an external geocoding service.
router.get('/location/reverse-geocode', authenticate, serviceRequestController.reverseGeocode);
// Mobile step 3: recommended providers for a draft (no request row exists yet).
router.get('/service-providers/recommended', authenticate, serviceRequestController.recommendedForDraft);
// Customer Find screen: browse all verified providers (optionally filtered).
router.get('/service-providers', authenticate, workflow.browseProviders);
// Find screen -> "View Profile": one provider's full profile + masked reviews.
// Registered after /recommended above so that path isn't captured by :id.
router.get('/service-providers/:id', authenticate, workflow.getProviderDetails);
// The mobile provider app fetches its inbox at /api/provider/service-requests; the same
// router also serves the web app at /api/providers/requests (see provider_routes.js).
router.use('/provider/service-requests', require('./servicerequest_routes').provider);
// Provider dashboard / jobs / earnings (mobile app).
router.use('/provider', require('./providerwork_routes'));

// Notifications + customer<->provider chat (workflow_controllers.js; tables from
// migrations/002_core_workflow_tables.sql).
router.get('/notifications', authenticate, workflow.listNotifications);
router.get('/conversations', authenticate, workflow.listConversations);
router.get('/conversations/:id/messages', authenticate, workflow.listMessages);
router.post('/conversations/:id/messages', authenticate, workflow.sendMessage);

// PayMongo: webhook (called by PayMongo, signature-verified, no JWT) and the
// browser landing page after checkout. See utils/paymongo.js.
router.post('/payments/webhook', workflow.paymongoWebhook);
router.get('/payments/return', workflow.paymentReturn);

// FCM push registration: the app registers its device token after login and
// removes it on logout. Every notification then also arrives as a push.
router.post('/devices', authenticate, workflow.registerDevice);
router.delete('/devices', authenticate, workflow.unregisterDevice);

module.exports = router;