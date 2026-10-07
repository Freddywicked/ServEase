const router = require('express').Router();
const { supabase } = require('../config/supabase');

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
// The mobile provider app fetches its inbox at /api/provider/service-requests; the same
// router also serves the web app at /api/providers/requests (see provider_routes.js).
router.use('/provider/service-requests', require('./servicerequest_routes').provider);

module.exports = router;