const ApiError = require('../utils/api_error');
const asyncHandler = require('../utils/async_handler');
const Provider = require('../models/provider_model');
const { uploadProviderFile } = require('../utils/storage');

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

  // Work/company details — service_providers.company_name / company_address.
  const companyName = body.companyName ? String(body.companyName).trim() : '';
  const companyAddress = body.companyAddress ? String(body.companyAddress).trim() : '';

  return { selectedCategories, homeRepairServices, otherServices, yearsOfExperience, offersHomeServices, companyName, companyAddress };
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
  const { selectedCategories, homeRepairServices, otherServices, yearsOfExperience, offersHomeServices, companyName, companyAddress } =
    parseBody(req.body);

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
    specializations,
  });

  res.status(201).json({ application });
});

module.exports = { me, apply };