const ApiError = require('../utils/api_error');
const asyncHandler = require('../utils/async_handler');
const User = require('../models/user_model');
const { parseRadiusKm } = require('../utils/radius');
const { EMAIL_RE } = require('../utils/validators');
const { uploadUserPhoto, getUserPhotoUrl } = require('../utils/storage');

const MODES = ['customer', 'service_provider'];

// Must match the value stored in service_providers.verification_status once an admin approves.
const VERIFIED = 'verified';

// PATCH /api/users/me — body: any of
//   { email, address,                   // account details (customer Edit Profile screen)
//     activeMode: 'customer' | 'service_provider',
//     prefersHomeService: boolean,      // customer's default for the Home Service choice
//     searchRadiusKm: 5-100 }           // customer's default provider search radius
// One account holds both roles, so activeMode only stores which side of the app the
// account opens in; it never creates or changes a provider record.
// Everything is validated before anything is saved, so a bad value changes nothing.
const updateMe = asyncHandler(async (req, res) => {
  const { email, address, activeMode, prefersHomeService, searchRadiusKm } = req.body || {};
  const hasProfile = email !== undefined || address !== undefined;
  const hasMode = activeMode !== undefined;
  const hasPreferences = prefersHomeService !== undefined || searchRadiusKm !== undefined;

  if (!hasProfile && !hasMode && !hasPreferences) {
    throw new ApiError(400, 'Send email, address, activeMode, prefersHomeService and/or searchRadiusKm');
  }

  // Account details. Per-field messages land in `details`, which the mobile app shows
  // under the matching input (err.fieldErrors in api/client.js).
  const profile = {};
  if (email !== undefined) {
    const normalized = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      throw new ApiError(400, 'Please fix the highlighted fields', { email: 'Enter a valid email address' });
    }
    profile.email = normalized;
  }
  if (address !== undefined) {
    const trimmed = String(address).trim();
    if (!trimmed) {
      throw new ApiError(400, 'Please fix the highlighted fields', { address: 'Address is required' });
    }
    profile.address = trimmed;
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
  if (hasProfile) user = await User.updateProfile(req.user.user_id, profile);
  if (hasMode) user = await User.setActiveMode(req.user.user_id, activeMode);
  if (hasPreferences) {
    user = await User.updatePreferences(req.user.user_id, { prefersHomeService, searchRadiusKm: radiusKm });
  }
  res.json({ user: await User.withPhotoUrl(user) });
});

// POST /api/users/me/photo — multipart, field "photo" -> { photoUrl }
// The file goes to the private profile-photos bucket; users.photo_url keeps the PATH
// and a short-lived signed URL is minted for the response (same pattern as provider photos).
const uploadMyPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Choose a photo to upload');
  const path = await uploadUserPhoto(req.user.user_id, req.file);
  await User.setPhoto(req.user.user_id, path);
  res.json({ photoUrl: await getUserPhotoUrl(path) });
});

module.exports = { updateMe, uploadMyPhoto };