const ApiError = require('../utils/api_error');
const asyncHandler = require('../utils/async_handler');
const Provider = require('../models/provider_model');
const User = require('../models/user_model');
const { uploadProviderFile, getProviderFileUrl } = require('../utils/storage');
const { EMAIL_RE } = require('../utils/validators');
const { DEFAULT_PROVIDER_RADIUS_KM, parseRadiusKm } = require('../utils/radius');

const HOME_REPAIR_CATEGORY = 'Home Repair Services';

// multipart/form-data arrives as plain strings, so lists are JSON-encoded by the app.
const parseList = (value) => {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
  } catch {
    return [];
  }
};

const parseBody = (body) => {
  const selectedCategories = parseList(body.selectedCategories);
  const homeRepairServices = parseList(body.homeRepairServices);
  const otherServices = parseList(body.otherServices);

  // Older app builds sent a single `otherService` string.
  const legacyOther = body.otherService ? String(body.otherService).trim() : '';
  if (legacyOther) otherServices.push(legacyOther);

  const yearsOfExperience = Number.isFinite(Number(body.yearsOfExperience)) ? Number(body.yearsOfExperience) : null;

  // The app sends 'yes' / 'no' (also tolerate true / 'true').
  const offersHomeServices = ['yes', 'true', '1'].includes(String(body.offersHomeServices).toLowerCase());

  // How far (km) the provider will travel for home service. Only asked when they offer it.
  // Older app builds don't send it, so a missing value falls back to the default instead of failing;
  // a value that IS sent must be 5-100 (parseRadiusKm throws a 400 otherwise).
  const rawRadius = body.homeServiceRadiusKm;
  const homeServiceRadiusKm = offersHomeServices
    ? rawRadius === undefined || rawRadius === '' || rawRadius === null
      ? DEFAULT_PROVIDER_RADIUS_KM
      : parseRadiusKm(rawRadius)
    : null;

  // Work/company details — service_providers.company_name / company_address.
  const companyName = body.companyName ? String(body.companyName).trim() : '';
  const companyAddress = body.companyAddress ? String(body.companyAddress).trim() : '';

  return {
    selectedCategories,
    homeRepairServices,
    otherServices,
    yearsOfExperience,
    offersHomeServices,
    homeServiceRadiusKm,
    companyName,
    companyAddress,
  };
};

// GET /api/providers/me — the logged-in user's own provider profile.
// `provider` is null when the user has not applied yet.
const me = asyncHandler(async (req, res) => {
  const provider = await Provider.findProfile(req.user.user_id);
  res.json({ provider });
});

// POST /api/providers/apply — req.user comes from the `authenticate`
// middleware, never from the request body, so no one can submit an
// application on someone else's behalf.
const apply = asyncHandler(async (req, res) => {
  const {
    selectedCategories,
    homeRepairServices,
    otherServices,
    yearsOfExperience,
    offersHomeServices,
    homeServiceRadiusKm,
    companyName,
    companyAddress,
  } = parseBody(req.body);

  if (!req.files?.validId?.[0]) throw new ApiError(400, 'A valid ID is required');
  if (!req.files?.selfie?.[0]) throw new ApiError(400, 'A selfie is required');
  if (!selectedCategories.length) throw new ApiError(400, 'Select at least one service category');
  if (yearsOfExperience === null) throw new ApiError(400, 'Enter your years of experience as a number');

  const existing = await Provider.findByUserId(req.user.user_id);
  if (existing) throw new ApiError(409, 'You already have a service provider application on file');

  const [government_id, profile_photo, certification] = await Promise.all([
    uploadProviderFile(req.user.user_id, 'id', req.files.validId[0]),
    uploadProviderFile(req.user.user_id, 'selfie', req.files.selfie[0]),
    req.files.supportingDocs?.[0] ? uploadProviderFile(req.user.user_id, 'docs', req.files.supportingDocs[0]) : null,
  ]);

  // Home repair services only count when the Home Repair category is selected.
  const homeServices = selectedCategories.includes(HOME_REPAIR_CATEGORY) ? homeRepairServices : [];

  // One SERVICE_PROVIDER_SPECIALIZATION row per selected category/service:
  // service_category is the parent category, specialization_name the category or
  // service itself (custom "other" services have no parent category -> null).
  const seen = new Set();
  const specializations = [
    ...selectedCategories.map((name) => ({ service_category: name, specialization_name: name })),
    ...homeServices.map((name) => ({ service_category: HOME_REPAIR_CATEGORY, specialization_name: name })),
    ...otherServices.map((name) => ({ service_category: null, specialization_name: name })),
  ].filter((s) => {
    const key = s.specialization_name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const application = await Provider.create({
    user_id: req.user.user_id,
    company_name: companyName || null,
    company_address: companyAddress || null,
    years_of_experience: yearsOfExperience,
    government_id,
    profile_photo,
    certification,
    offers_home_service: offersHomeServices,
    home_service_radius_km: homeServiceRadiusKm,
    specializations,
  });

  res.status(201).json({ application });
});

// ===================== OWN PROFILE (mobile Profile / Edit Profile) =====================

// Availability lives in the single text column service_providers.availability, stored as
// one human-readable line ("Mon, Wed, Fri · 9:00 AM - 5:00 PM"): the web provider cards
// show it as-is, and the helpers below turn it back into the structured days/hours the
// mobile edit form needs.
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const AVAILABILITY_SEP = ' · ';
const HOURS_RE = /\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[-–—]\s*\d{1,2}:\d{2}\s*(?:AM|PM)/i;
const STRICT_HOURS_RE = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)\s*[-–—]\s*(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i;

// "Mon, Wed, Fri · 9:00 AM - 5:00 PM" -> { days: ['Mon','Wed','Fri'], hours: '9:00 AM - 5:00 PM' }
// Either side is null when the stored text doesn't carry it.
const parseAvailability = (text) => {
  const result = { days: null, hours: null };
  if (!text) return result;
  const hoursMatch = String(text).match(HOURS_RE);
  if (hoursMatch) result.hours = hoursMatch[0].replace(/\s+/g, ' ').trim();
  const daysText = hoursMatch ? String(text).replace(hoursMatch[0], '') : String(text);
  const days = DAY_NAMES.filter((day) => new RegExp(`\\b${day}\\b`, 'i').test(daysText));
  if (days.length) result.days = days;
  return result;
};

// ['Mon','Wed','Fri'] + '9:00 AM - 5:00 PM' -> "Mon, Wed, Fri · 9:00 AM - 5:00 PM" (null when empty).
const formatAvailability = (days, hours) => {
  const parts = [];
  if (days && days.length) parts.push(days.join(', '));
  if (hours) parts.push(hours);
  return parts.length ? parts.join(AVAILABILITY_SEP) : null;
};

// The payload both GET and PATCH /api/providers/me/profile return — exactly what the
// mobile Profile screen (ServiceProviderProfile.js) renders. The verification documents
// (valid ID, selfie, supporting docs) are never included.
// TODO: reviews, rating and aiSummary stay empty until the reviews data is wired in.
const profilePayload = async (user, profile) => {
  const { days, hours } = parseAvailability(profile.availability);
  return {
    fullName: user.name || null,
    specialty: profile.specializations?.length ? profile.specializations.join(', ') : null,
    yearsExperience: profile.years_of_experience ?? null,
    // profile_photo is a private storage path; sign it so the app can render it.
    photoUrl: await getProviderFileUrl(profile.profile_photo),
    rating: null,
    reviewCount: 0,
    aiSummary: { positiveFeedbackPercent: null, tags: [] },
    reviews: [],
    account: {
      email: user.email || null,
      address: user.address || null,
    },
    other: {
      availabilityDays: days,
      availabilityHours: hours,
      companyAddress: profile.company_address || null,
      companyName: profile.company_name || null,
    },
  };
};

// GET /api/providers/me/profile
const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await Provider.findProfile(req.user.user_id);
  if (!profile) throw new ApiError(403, 'Provider account required');
  res.json(await profilePayload(req.user, profile));
});

// PATCH /api/providers/me/profile — body: any of
//   { email, address,                              // account details (users table)
//     availabilityDays: ['Mon', ...],              // [] clears the days
//     availabilityHours: '9:00 AM - 5:00 PM' | null, // null/'' clears the hours
//     companyName, companyAddress }                // provider company details
// Everything is validated before anything is saved, so a bad value changes nothing.
const updateMyProfile = asyncHandler(async (req, res) => {
  const profile = await Provider.findProfile(req.user.user_id);
  if (!profile) throw new ApiError(403, 'Provider account required');

  const { email, address, availabilityDays, availabilityHours, companyName, companyAddress } = req.body || {};
  if ([email, address, availabilityDays, availabilityHours, companyName, companyAddress].every((v) => v === undefined)) {
    throw new ApiError(400, 'Send email, address, availabilityDays, availabilityHours, companyName and/or companyAddress');
  }

  // Account details. Per-field messages land in `details`, which the mobile app shows
  // under the matching input (err.fieldErrors in api/client.js). Same rules as PATCH /users/me;
  // a duplicate email hits the unique index and db.js turns it into a 409.
  const accountChanges = {};
  if (email !== undefined) {
    const normalized = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      throw new ApiError(400, 'Please fix the highlighted fields', { email: 'Enter a valid email address' });
    }
    accountChanges.email = normalized;
  }
  if (address !== undefined) {
    const trimmed = String(address).trim();
    if (!trimmed) {
      throw new ApiError(400, 'Please fix the highlighted fields', { address: 'Address is required' });
    }
    accountChanges.address = trimmed;
  }

  // Days arrive as ['Mon', 'Tue', ...] (case-insensitive, deduped, stored Mon..Sun).
  let days;
  if (availabilityDays !== undefined) {
    if (!Array.isArray(availabilityDays)) throw new ApiError(400, 'availabilityDays must be an array of day names');
    days = [];
    for (const value of availabilityDays) {
      const day = DAY_NAMES.find((d) => d.toLowerCase() === String(value).trim().slice(0, 3).toLowerCase());
      if (!day) throw new ApiError(400, `Unknown availability day: ${value}`);
      if (!days.includes(day)) days.push(day);
    }
    days.sort((a, b) => DAY_NAMES.indexOf(a) - DAY_NAMES.indexOf(b));
  }

  // Hours arrive as '9:00 AM - 5:00 PM'; null clears them. Stored normalized ("9:00 AM - 5:00 PM").
  let hours;
  if (availabilityHours !== undefined) {
    if (availabilityHours === null || String(availabilityHours).trim() === '') {
      hours = null;
    } else {
      const m = STRICT_HOURS_RE.exec(String(availabilityHours).trim());
      if (!m) throw new ApiError(400, "availabilityHours must look like '9:00 AM - 5:00 PM'");
      hours = `${Number(m[1])}:${m[2]} ${m[3].toUpperCase()} - ${Number(m[4])}:${m[5]} ${m[6].toUpperCase()}`;
    }
  }

  // Company details: trimmed; an empty string clears the value.
  const providerChanges = {};
  if (companyName !== undefined) providerChanges.companyName = String(companyName).trim() || null;
  if (companyAddress !== undefined) providerChanges.companyAddress = String(companyAddress).trim() || null;

  // availability is one text column holding days + hours; changing only one side keeps the other.
  if (days !== undefined || hours !== undefined) {
    const current = parseAvailability(profile.availability);
    providerChanges.availability = formatAvailability(
      days !== undefined ? days : current.days,
      hours !== undefined ? hours : current.hours
    );
  }

  let user = req.user;
  if (Object.keys(accountChanges).length) user = await User.updateProfile(req.user.user_id, accountChanges);
  if (Object.keys(providerChanges).length) await Provider.updateProfileDetails(req.user.user_id, providerChanges);

  const updated = await Provider.findProfile(req.user.user_id);
  res.json(await profilePayload(user, updated));
});

// POST /api/providers/me/photo — multipart, field "photo" -> { photoUrl }
// Same pattern as the customer's /users/me/photo: the file goes to the private
// provider-applications bucket (where the application selfie already lives),
// service_providers.profile_photo keeps the PATH and a short-lived signed URL is
// minted for the response.
const uploadMyPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Choose a photo to upload');
  const profile = await Provider.findProfile(req.user.user_id);
  if (!profile) throw new ApiError(403, 'Provider account required');
  const path = await uploadProviderFile(req.user.user_id, 'photo', req.file);
  await Provider.setProfilePhoto(req.user.user_id, path);
  res.json({ photoUrl: await getProviderFileUrl(path) });
});

module.exports = { me, apply, getMyProfile, updateMyProfile, uploadMyPhoto };