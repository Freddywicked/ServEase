const ApiError = require('./api_error');

// One range for every radius in the app (customer search radius AND provider home-service
// range). Keep in step with MIN/MAX_RADIUS_KM in the mobile app's components/RadiusSlider.js
// and with the CHECK constraints in migrations/radius_preferences.sql.
const MIN_RADIUS_KM = 5;
const MAX_RADIUS_KM = 100;
const DEFAULT_PROVIDER_RADIUS_KM = 10;
const DEFAULT_CUSTOMER_RADIUS_KM = 15;

// Strict: for SAVING a value a user chose. Anything outside 5-100 km is a 400.
const parseRadiusKm = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < MIN_RADIUS_KM || n > MAX_RADIUS_KM) {
    throw new ApiError(400, `Radius must be between ${MIN_RADIUS_KM} and ${MAX_RADIUS_KM} km`);
  }
  return Math.round(n);
};

// Lenient: for a SEARCH query param. A missing/invalid value uses the fallback, and
// an out-of-range value is clamped, so a search never fails because of the radius.
const clampRadiusKm = (value, fallback = DEFAULT_CUSTOMER_RADIUS_KM) => {
  const n = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(n)) return fallback;
  return Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, Math.round(n)));
};

module.exports = {
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  DEFAULT_PROVIDER_RADIUS_KM,
  DEFAULT_CUSTOMER_RADIUS_KM,
  parseRadiusKm,
  clampRadiusKm,
};