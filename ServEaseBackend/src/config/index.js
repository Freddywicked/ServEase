/**
 * Centralised environment configuration.
 * Copy .env.example to .env and fill in real values.
 * @format
 */

import 'dotenv/config';

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  corsOrigins: (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'verification-docs',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'servease-dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  otp: {
    ttlMinutes: Number(process.env.OTP_TTL_MINUTES || 10),
    resendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60),
    maxAttempts: 5,
  },
  philsms: {
    // PhilSMS dashboard -> API Token. When empty (local dev), OTP delivery
    // falls back to logging the code to the server console.
    apiToken: process.env.PHILSMS_API_TOKEN || '',
    senderId: process.env.PHILSMS_SENDER_ID || 'PhilSMS',
    // Outside production a failed SMS send (e.g. PhilSMS "sending limit
    // exceeded" on a trial account) falls back to logging the code so the
    // app stays testable. In production the failure surfaces as a 502.
    allowFallback: process.env.NODE_ENV !== 'production',
  },
};

export default config;
