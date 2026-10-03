const ApiError = require('../utils/api_error');
const asyncHandler = require('../utils/async_handler');
const User = require('../models/user_model');

const MODES = ['customer', 'service_provider'];

// Must match the value stored in service_providers.verification_status once an admin approves.
const VERIFIED = 'verified';

// PATCH /api/users/me — body: { activeMode: 'customer' | 'service_provider' }
// One account holds both roles, so this only stores which side of the app the
// account opens in; it never creates or changes a provider record.
const updateMe = asyncHandler(async (req, res) => {
  const { activeMode } = req.body || {};
  if (!MODES.includes(activeMode)) {
    throw new ApiError(400, `activeMode must be one of: ${MODES.join(', ')}`);
  }

  // Every provider is also a customer, so switching to 'customer' is always allowed.
  // Provider mode follows BR-05: only verified providers.
  if (activeMode === 'service_provider') {
    const provider = await User.findProvider(req.user.user_id);
    if (!provider) throw new ApiError(403, 'Provider account required');
    if (provider.verification_status !== VERIFIED) {
      throw new ApiError(403, 'Your provider account is still pending verification');
    }
  }

  const user = await User.setActiveMode(req.user.user_id, activeMode);
  res.json({ user: User.toPublic(user) });
});

module.exports = { updateMe };