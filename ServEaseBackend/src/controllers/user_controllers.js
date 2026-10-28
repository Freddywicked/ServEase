const ApiError = require('../utils/api_error');
const asyncHandler = require('../utils/async_handler');
const User = require('../models/user_model');
const { parseRadiusKm } = require('../utils/radius');

const MODES = ['customer', 'service_provider'];

// Must match the value stored in service_providers.verification_status once an admin approves.
const VERIFIED = 'verified';

// PATCH /api/users/me — body: any of
//   { activeMode: 'customer' | 'service_provider',
//     prefersHomeService: boolean,      // customer's default for the Home Service choice
//     searchRadiusKm: 5-100 }           // customer's default provider search radius
// One account holds both roles, so activeMode only stores which side of the app the
// account opens in; it never creates or changes a provider record.
// Everything is validated before anything is saved, so a bad value changes nothing.
const updateMe = asyncHandler(async (req, res) => {
  const { activeMode, prefersHomeService, searchRadiusKm } = req.body || {};
  const hasMode = activeMode !== undefined;
  const hasPreferences = prefersHomeService !== undefined || searchRadiusKm !== undefined;

  if (!hasMode && !hasPreferences) {
    throw new ApiError(400, 'Send activeMode, prefersHomeService and/or searchRadiusKm');
  }
  if (hasMode && !MODES.includes(activeMode)) {
    throw new ApiError(400, `activeMode must be one of: ${MODES.join(', ')}`);
  }
  if (prefersHomeService !== undefined && typeof prefersHomeService !== 'boolean') {
    throw new ApiError(400, 'prefersHomeService must be true or false');
  }
  const radiusKm = searchRadiusKm !== undefined ? parseRadiusKm(searchRadiusKm) : undefined;

  // Every provider is also a customer, so switching to 'customer' is always allowed.
  // Provider mode follows BR-05: only verified providers.
  if (hasMode && activeMode === 'service_provider') {
    const provider = await User.findProvider(req.user.user_id);
    if (!provider) throw new ApiError(403, 'Provider account required');
    if (provider.verification_status !== VERIFIED) {
      throw new ApiError(403, 'Your provider account is still pending verification');
    }
  }

  let user = req.user;
  if (hasMode) user = await User.setActiveMode(req.user.user_id, activeMode);
  if (hasPreferences) {
    user = await User.updatePreferences(req.user.user_id, { prefersHomeService, searchRadiusKm: radiusKm });
  }
  res.json({ user: User.toPublic(user) });
});

module.exports = { updateMe };