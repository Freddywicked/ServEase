/**
 * Central configuration. Everything else in the backend imports from here
 * instead of reading process.env directly, so the variable names live in one
 * place. Values come from the .env file in the ServEaseBackend root.
 */

import 'dotenv/config';

const env = process.env;

// Only these are needed for the server to start. The optional integrations
// (PhilSMS, PayMongo, Google Maps, ...) can stay empty until you build them.
const required = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'JWT_SECRET'];
const missing = required.filter(name => !env[name]);
if (missing.length > 0) {
  throw new Error(`Missing required values in .env: ${missing.join(', ')}`);
}

const nodeEnv = env.NODE_ENV || 'development';

const config = {
  nodeEnv,
  port: Number(env.PORT) || 4000,
  // The web app's address, used to restrict CORS.
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
  },

  philsms: {
    // Empty means "not configured": otp.js prints the code in the terminal
    // instead of sending an SMS.
    apiToken: env.PHILSMS_API_TOKEN || '',
    senderId: env.PHILSMS_SENDER_ID || 'PhilSMS',
    // Outside production, if PhilSMS rejects a send (for example no credits),
    // the code is printed in the terminal so you can keep testing. In
    // production a failed send returns an error instead.
    allowFallback: nodeEnv !== 'production',
  },
};

export default config;