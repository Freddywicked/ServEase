/**
 * Forgot Password flow: request code -> verify code -> set new password.
 * Mounted in server.js at /api/auth, BEFORE app.use('/api', apiRoutes).
 *
 * Needs: npm i resend bcryptjs express-rate-limit, and the password_resets table
 * (password_resets.sql). Code length/expiry/attempts/cooldown come from config.otp.
 */
const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { supabase } = require('../config/supabase');
const { unwrap } = require('../utils/db');
const { sendPasswordResetEmail } = require('../services/email');

// The users table's primary key is user_id (migration 001 renamed id -> user_id).
const USERS_TABLE = 'users';
const ID_COLUMN = 'user_id';
const PASSWORD_COLUMN = 'password_hash';
const BCRYPT_ROUNDS = 10;

const TABLE = 'password_resets';
const OTP_LENGTH = 6; // the app's code screen has six boxes
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isStrongPassword = (p) =>
  typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

const router = express.Router();

const normalizeEmail = (v) => String(v || '').trim().toLowerCase();
const hash = (value) =>
  crypto.createHmac('sha256', config.passwordReset.hashSecret).update(String(value)).digest('hex');
const safeEqual = (a, b) => {
  const A = Buffer.from(a || '');
  const B = Buffer.from(b || '');
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

// 1) Request a code. Always answers the same way so emails can't be probed.
router.post('/forgot-password', limiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({
      message: 'Enter a valid email address.',
      details: { email: 'Enter a valid email address.' },
    });
  }

  const cooldown = config.otp.resendCooldownSeconds;
  const generic = (resendAfter) =>
    res.json({ message: 'If this email is registered, we sent a verification code.', resendAfter });

  try {
    const user = unwrap(await supabase.from(USERS_TABLE).select(ID_COLUMN).eq('email', email).maybeSingle());
    if (!user) return generic(cooldown);

    const existing = unwrap(
      await supabase.from(TABLE).select('last_sent_at').eq('email', email).maybeSingle()
    );
    if (existing) {
      const elapsed = (Date.now() - new Date(existing.last_sent_at).getTime()) / 1000;
      if (elapsed < cooldown) return generic(Math.ceil(cooldown - elapsed));
    }

    const code = crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
    unwrap(
      await supabase.from(TABLE).upsert({
        email,
        otp_hash: hash(code),
        otp_expires_at: new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000).toISOString(),
        attempts: 0,
        last_sent_at: new Date().toISOString(),
        reset_token_hash: null,
        reset_token_expires_at: null,
      })
    );

    try {
      await sendPasswordResetEmail(email, code);
    } catch (err) {
      // Sending failed: remove the row so "Resend" isn't blocked by the cooldown.
      await supabase.from(TABLE).delete().eq('email', email);
      throw err;
    }
    return generic(cooldown);
  } catch (err) {
    console.error('forgot-password failed:', err);
    return res.status(500).json({ message: 'Could not send the code. Please try again.' });
  }
});

// 2) Verify the code. Returns a short-lived, single-use reset token.
router.post('/verify-reset-otp', limiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();
  const invalid = () => res.status(400).json({ message: 'Invalid or expired code.' });

  if (!EMAIL_RE.test(email) || !new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otp)) return invalid();

  try {
    const row = unwrap(await supabase.from(TABLE).select('*').eq('email', email).maybeSingle());
    if (!row || !row.otp_hash || new Date(row.otp_expires_at) < new Date()) return invalid();

    if (row.attempts >= config.otp.maxAttempts) {
      return res.status(429).json({ message: 'Too many attempts. Please request a new code.' });
    }

    if (!safeEqual(hash(otp), row.otp_hash)) {
      await supabase.from(TABLE).update({ attempts: row.attempts + 1 }).eq('email', email);
      return invalid();
    }

    const ttl = config.passwordReset.resetTokenTtlMinutes;
    const resetToken = crypto.randomBytes(32).toString('hex');
    unwrap(
      await supabase.from(TABLE).update({
        otp_hash: null, // the code is single-use
        reset_token_hash: hash(resetToken),
        reset_token_expires_at: new Date(Date.now() + ttl * 60 * 1000).toISOString(),
      }).eq('email', email)
    );

    return res.json({ resetToken, expiresIn: ttl * 60 });
  } catch (err) {
    console.error('verify-reset-otp failed:', err);
    return res.status(500).json({ message: 'Could not verify the code. Please try again.' });
  }
});

// 3) Save the new password.
router.post('/reset-password', limiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { resetToken, password } = req.body;
  const expired = () =>
    res.status(400).json({ message: 'Your reset session has expired. Please start again.' });

  if (!EMAIL_RE.test(email) || !resetToken) return expired();
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      message: 'Use at least 8 characters with letters and numbers.',
      details: { password: 'Use at least 8 characters with letters and numbers.' },
    });
  }

  try {
    const row = unwrap(await supabase.from(TABLE).select('*').eq('email', email).maybeSingle());
    if (
      !row ||
      !row.reset_token_hash ||
      new Date(row.reset_token_expires_at) < new Date() ||
      !safeEqual(hash(resetToken), row.reset_token_hash)
    ) {
      return expired();
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    unwrap(
      await supabase.from(USERS_TABLE).update({ [PASSWORD_COLUMN]: passwordHash }).eq('email', email)
    );

    await supabase.from(TABLE).delete().eq('email', email); // the token is single-use
    return res.json({ message: 'Your password has been updated. Please log in with your new password.' });
  } catch (err) {
    console.error('reset-password failed:', err);
    return res.status(500).json({ message: 'Could not update your password. Please try again.' });
  }
});

module.exports = router;