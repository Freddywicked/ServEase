/**
 * OTP generation, storage (Supabase table: signup_otps) and delivery (PhilSMS).
 * Codes are stored in the database, so they survive server/nodemon restarts.
 */
const crypto = require('node:crypto');
const config = require('../config');
const { supabase } = require('../config/supabase');
const { unwrap } = require('../utils/db');

const PHILSMS_SEND_URL = `${process.env.PHILSMS_BASE_URL || 'https://dashboard.philsms.com/api/v3'}/sms/send`;
const TABLE = 'signup_otps';
const RESEND_COOLDOWN_MS = config.otp.resendCooldownSeconds * 1000;

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const generateOtpCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

const emailKey = (email) => String(email).trim().toLowerCase();

/**
 * Normalises a Philippine mobile number to 639XXXXXXXXX (PhilSMS format).
 * Accepts "09XXXXXXXXX", "9XXXXXXXXX", "+639XXXXXXXXX" or "639XXXXXXXXX", with or without spaces.
 */
const normalizePhPhone = (phone) => {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('09') && digits.length === 11) return `63${digits.slice(1)}`;
  if (digits.startsWith('9') && digits.length === 10) return `63${digits}`;
  return digits;
};

/**
 * Delivers the OTP via SMS through PhilSMS. When no token is configured, or
 * outside production if PhilSMS rejects the send, the code is printed in the
 * server terminal so the flow stays testable.
 */
const sendOtpSms = async (phone, code) => {
  const message = `Your ServEase verification code is ${code}. It expires in ${config.otp.ttlMinutes} minutes. Do not share it with anyone.`;

  if (!config.philsms.apiToken) {
    console.log(`[sms-mock] OTP for ${phone}: ${code}`);
    return;
  }

  const response = await fetch(PHILSMS_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.philsms.apiToken.trim()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      recipient: normalizePhPhone(phone),
      sender_id: config.philsms.senderId,
      type: 'plain',
      message,
    }),
  });
  const detail = await response.text().catch(() => '');
  console.log('[philsms] response:', response.status, detail);

  // PhilSMS can answer HTTP 200 with an error inside the body, so check both.
  let body = null;
  try {
    body = JSON.parse(detail);
  } catch {
    /* not JSON */
  }
  const failed = !response.ok || (body && body.status && body.status !== 'success');
  if (!failed) return;

  console.error(`[philsms] Failed to send OTP to ${phone}: ${detail}`);
  if (config.philsms.allowFallback) {
    console.log(`[sms-fallback] OTP for ${phone}: ${code}`);
    return;
  }
  throw httpError(502, 'Failed to send the verification code.');
};

// Step 1 of signup: make a code, store it, text it to the phone number.
const sendOtp = async ({ email, phone }) => {
  const key = emailKey(email);
  const normalizedPhone = normalizePhPhone(phone);

  // Server-side resend cooldown (protects your SMS credits).
  const existing = unwrap(
    await supabase.from(TABLE).select('last_sent_at').eq('email', key).maybeSingle()
  );
  if (existing && Date.now() - new Date(existing.last_sent_at).getTime() < RESEND_COOLDOWN_MS) {
    throw httpError(429, 'Please wait a few seconds before requesting another code.');
  }

  const code = generateOtpCode();
  unwrap(
    await supabase.from(TABLE).upsert({
      email: key,
      phone: normalizedPhone,
      code_hash: hashCode(code),
      expires_at: new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000).toISOString(),
      attempts: 0,
      last_sent_at: new Date().toISOString(),
    })
  );

  // Development only: always print the code so you are never stuck.
  if (config.nodeEnv !== 'production') {
    console.log(`[dev] OTP for ${key} (${normalizedPhone}): ${code}`);
  }

  try {
    await sendOtpSms(normalizedPhone, code);
  } catch (err) {
    // Sending failed: remove the row so "Try again" isn't blocked by the cooldown.
    await supabase.from(TABLE).delete().eq('email', key);
    throw err;
  }
};

// Step 2 of signup: true only if the code matches, isn't expired, wasn't
// guessed too many times, and the phone is the one the code was sent to.
// A correct code can be used once.
const verifyOtp = async (email, code, phone) => {
  const key = emailKey(email);
  const entry = unwrap(await supabase.from(TABLE).select('*').eq('email', key).maybeSingle());
  if (!entry) return false;

  const remove = () => supabase.from(TABLE).delete().eq('email', key);

  if (Date.now() > new Date(entry.expires_at).getTime()) {
    await remove();
    return false;
  }
  if (entry.attempts >= config.otp.maxAttempts) {
    await remove();
    return false;
  }
  if (phone && normalizePhPhone(phone) !== entry.phone) return false;

  if (entry.code_hash !== hashCode(String(code).trim())) {
    await supabase.from(TABLE).update({ attempts: entry.attempts + 1 }).eq('email', key);
    return false;
  }

  await remove();
  return true;
};

module.exports = { generateOtpCode, normalizePhPhone, sendOtpSms, sendOtp, verifyOtp };