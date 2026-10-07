/**
 * Central configuration. Everything else in the backend imports from here
 * instead of reading process.env directly, so the variable names live in one
 * place. Values come from the .env file in the ServEaseBackend root.
 *
 * Location: ServEaseBackend/config/index.js  (next to config/supabase.js)
 * Loaded with require('./config') from app.js and require('../config') from services/.
 */
require('dotenv').config();

const env = process.env;

// Only these are needed for the server to start. The optional integrations
// (PhilSMS, PayMongo, Google Maps, ...) can stay empty until you build them.
const required = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'JWT_SECRET'];
const missing = required.filter((name) => !env[name]);
if (missing.length > 0) {
  throw new Error(`Missing required values in .env: ${missing.join(', ')}`);
}

const nodeEnv = env.NODE_ENV || 'development';

const config = {
  nodeEnv,
  // Must match BASE_URL in the mobile app's api/client.js.
  port: Number(env.PORT) || 5000,
  // The web app's address(es), used to restrict CORS. Separate several with commas.
  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',

  supabase: {
    url: env.SUPABASE_URL,
    secretKey: env.SUPABASE_SECRET_KEY,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN || '7d',
  },

  otp: {
    ttlMinutes: Number(env.OTP_TTL_MINUTES) || 5,
    // Wrong guesses allowed before a code stops working.
    maxAttempts: 5,
    // Minimum wait between two codes for the same email (matches the app's 30s countdown).
    resendCooldownSeconds: Number(env.OTP_RESEND_COOLDOWN_SECONDS) || 30,
  },

  philsms: {
    // Empty means "not configured": otp.js prints the code in the terminal
    // instead of sending an SMS.
    apiToken: env.PHILSMS_API_TOKEN || '',
    senderId: env.PHILSMS_SENDER_ID || 'PhilSMS',
    // Outside production, if PhilSMS rejects a send (for example no credits),
    // the code is printed in the terminal so you can keep testing.
    allowFallback: nodeEnv !== 'production',
  },

  googleMaps: {
    // Server-side Google Maps Platform key, used for reverse geocoding and the
    // Static Maps snapshot the apps show instead of a live map. Empty means
    // /location/reverse-geocode falls back to OpenStreetMap for the address and
    // returns mapImageUri: null (the apps already handle that). Must be set on the
    // deployed server too (Render -> Environment), or the release app shows no map.
    apiKey: env.GOOGLE_MAPS_API_KEY || '',
  },

  ai: {
    // Gemini (Google AI). AI_API_URL is the full generateContent endpoint, model
    // included (e.g. .../models/gemini-flash-latest:generateContent). An empty
    // apiKey means utils/ai_diagnosis.js uses its keyword-based fallback instead.
    apiKey: env.AI_API_KEY || '',
    apiUrl:
      env.AI_API_URL ||
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
  },
};

module.exports = config;