/**
 * Authentication controller: customer registration, phone OTP
 * verification, login and password reset.
 * @format
 */

import bcrypt from 'bcryptjs';
import config from '../config/index.js';
import { getSupabase } from '../config/supabase.js';
import { signAccessToken } from '../utils/tokens.js';
import { generateOtpCode, sendOtpSms } from '../utils/otp.js';
import { uploadVerificationDocument } from '../utils/storage.js';
import { findMissingFields, isEmail } from '../utils/validators.js';
import { httpError } from '../middleware/errorHandler.js';

const OTP_PURPOSES = {
  VERIFY_PHONE: 'verify_phone',
  RESET_PASSWORD: 'reset_password',
};

const publicUser = user => ({
  id: user.id,
  fullName: user.full_name,
  email: user.email,
  phone: user.phone,
  address: user.address,
  role: user.role,
  status: user.status,
  createdAt: user.created_at,
});

const createOtp = async (phone, purpose) => {
  const supabase = getSupabase();
  const code = generateOtpCode();
  const expiresAt = new Date(
    Date.now() + config.otp.ttlMinutes * 60_000,
  ).toISOString();
  const { data: otpRow, error } = await supabase
    .from('otp_codes')
    .insert({ phone, code, purpose, expires_at: expiresAt })
    .select('id')
    .single();
  if (error) {
    throw httpError(500, 'Failed to create the verification code.');
  }
  try {
    await sendOtpSms(phone, code);
  } catch (smsError) {
    // Remove the undelivered code so it cannot be consumed accidentally.
    await supabase.from('otp_codes').delete().eq('id', otpRow.id);
    throw smsError;
  }
  return code;
};

const consumeOtp = async (phone, purpose, code) => {
  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('phone', phone)
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    throw httpError(500, 'Failed to check the verification code.');
  }
  const otp = rows?.[0];
  if (!otp) {
    return {
      ok: false,
      message: 'No verification code found. Please request a new one.',
    };
  }
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      message: 'The verification code has expired. Please request a new one.',
    };
  }
  if (otp.attempts >= config.otp.maxAttempts) {
    return {
      ok: false,
      message: 'Too many incorrect attempts. Please request a new code.',
    };
  }
  if (otp.code !== String(code).trim()) {
    await supabase
      .from('otp_codes')
      .update({ attempts: otp.attempts + 1 })
      .eq('id', otp.id);
    return { ok: false, message: 'Incorrect verification code.' };
  }
  await supabase
    .from('otp_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', otp.id);
  return { ok: true };
};

/** POST /api/auth/register (multipart, optional "validId" file) */
export const register = async (req, res, next) => {
  try {
    const { fullName, email, phone, password, address } = req.body;
    const missing = findMissingFields(req.body, [
      'fullName',
      'email',
      'phone',
      'password',
      'address',
    ]);
    if (missing.length) {
      return res
        .status(400)
        .json({ message: `Missing required fields: ${missing.join(', ')}.` });
    }
    if (!isEmail(email)) {
      return res
        .status(400)
        .json({ message: 'Please provide a valid email address.' });
    }
    if (String(password).length < 8) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters long.' });
    }

    const supabase = getSupabase();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    const { data: existing, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${normalizedEmail},phone.eq.${normalizedPhone}`)
      .limit(1);
    if (lookupError) {
      throw httpError(500, 'Failed to check existing accounts.');
    }
    if (existing?.length) {
      return res.status(409).json({
        message: 'An account with this email or phone number already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({
        full_name: fullName.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password_hash: passwordHash,
        address: address.trim(),
      })
      .select()
      .single();
    if (insertError) {
      throw httpError(500, 'Failed to create the account.');
    }

    if (req.file) {
      const path = await uploadVerificationDocument(
        user.id,
        'valid-id',
        req.file,
      );
      await supabase
        .from('users')
        .update({ valid_id_url: path })
        .eq('id', user.id);
    }

    const code = await createOtp(user.phone, OTP_PURPOSES.VERIFY_PHONE);
    return res.status(201).json({
      message: 'Account created. Enter the 6-digit code sent to your phone.',
      phone: user.phone,
      ...(config.env !== 'production' ? { devOtp: code } : {}),
    });
  } catch (error) {
    return next(error);
  }
};

/** POST /api/auth/verify-otp */
export const verifyOtp = async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    const missing = findMissingFields(req.body, ['phone', 'code']);
    if (missing.length) {
      return res
        .status(400)
        .json({ message: `Missing required fields: ${missing.join(', ')}.` });
    }

    const supabase = getSupabase();
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone.trim())
      .maybeSingle();
    if (!user) {
      return res
        .status(404)
        .json({ message: 'No account found for this phone number.' });
    }

    const result = await consumeOtp(user.phone, OTP_PURPOSES.VERIFY_PHONE, code);
    if (!result.ok) {
      return res.status(400).json({ message: result.message });
    }

    const { data: updated } = await supabase
      .from('users')
      .update({ status: 'active', phone_verified_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    return res.json({
      message: 'Phone number verified. Your account is now active.',
      token: signAccessToken(updated),
      user: publicUser(updated),
    });
  } catch (error) {
    return next(error);
  }
};

/** POST /api/auth/resend-otp */
export const resendOtp = async (req, res, next) => {
  try {
    const missing = findMissingFields(req.body, ['phone']);
    if (missing.length) {
      return res
        .status(400)
        .json({ message: `Missing required fields: ${missing.join(', ')}.` });
    }

    const supabase = getSupabase();
    const normalizedPhone = req.body.phone.trim();
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle();
    if (!user) {
      return res
        .status(404)
        .json({ message: 'No account found for this phone number.' });
    }

    const { data: latest } = await supabase
      .from('otp_codes')
      .select('created_at')
      .eq('phone', normalizedPhone)
      .eq('purpose', OTP_PURPOSES.VERIFY_PHONE)
      .order('created_at', { ascending: false })
      .limit(1);
    const lastSentAt = latest?.[0]?.created_at
      ? new Date(latest[0].created_at).getTime()
      : 0;
    if (Date.now() - lastSentAt < config.otp.resendCooldownSeconds * 1000) {
      return res
        .status(429)
        .json({ message: 'Please wait a moment before requesting another code.' });
    }

    const code = await createOtp(normalizedPhone, OTP_PURPOSES.VERIFY_PHONE);
    return res.json({
      message: 'A new verification code has been sent.',
      ...(config.env !== 'production' ? { devOtp: code } : {}),
    });
  } catch (error) {
    return next(error);
  }
};

/** POST /api/auth/login */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const missing = findMissingFields(req.body, ['email', 'password']);
    if (missing.length) {
      return res
        .status(400)
        .json({ message: `Missing required fields: ${missing.join(', ')}.` });
    }

    const supabase = getSupabase();
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (user.status === 'pending') {
      // Issue a fresh verification code so the user can complete phone
      // verification straight from the OTP screen they are routed to.
      // If delivery fails (e.g. SMS quota exhausted) still route the user to
      // the OTP screen so they can request a new code there; in development
      // the latest unconsumed code is surfaced as devOtp.
      let code;
      try {
        code = await createOtp(user.phone, OTP_PURPOSES.VERIFY_PHONE);
      } catch (otpError) {
        console.error(
          `Failed to send a verification code to ${user.phone}: ${otpError.message}`,
        );
        if (config.env !== 'production') {
          const { data: latest } = await supabase
            .from('otp_codes')
            .select('code')
            .eq('phone', user.phone)
            .eq('purpose', OTP_PURPOSES.VERIFY_PHONE)
            .is('consumed_at', null)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);
          code = latest?.[0]?.code;
        }
      }
      return res.status(403).json({
        message: 'Please verify your phone number before signing in.',
        requiresOtp: true,
        phone: user.phone,
        ...(code && config.env !== 'production' ? { devOtp: code } : {}),
      });
    }
    if (user.status === 'suspended') {
      return res
        .status(403)
        .json({ message: 'This account has been suspended.' });
    }

    return res.json({
      message: 'Signed in successfully.',
      token: signAccessToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

/** POST /api/auth/forgot-password */
export const forgotPassword = async (req, res, next) => {
  try {
    const missing = findMissingFields(req.body, ['email']);
    if (missing.length) {
      return res
        .status(400)
        .json({ message: `Missing required fields: ${missing.join(', ')}.` });
    }

    const supabase = getSupabase();
    const { data: user } = await supabase
      .from('users')
      .select('id, phone')
      .eq('email', req.body.email.trim().toLowerCase())
      .maybeSingle();

    // Respond identically whether or not the account exists to avoid
    // leaking which emails are registered.
    const response = {
      message:
        'If an account exists for this email, a reset code has been sent to its phone number.',
    };
    if (user) {
      const code = await createOtp(user.phone, OTP_PURPOSES.RESET_PASSWORD);
      if (config.env !== 'production') {
        response.devOtp = code;
      }
    }
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

/** POST /api/auth/reset-password */
export const resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;
    const missing = findMissingFields(req.body, ['email', 'code', 'newPassword']);
    if (missing.length) {
      return res
        .status(400)
        .json({ message: `Missing required fields: ${missing.join(', ')}.` });
    }
    if (String(newPassword).length < 8) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters long.' });
    }

    const supabase = getSupabase();
    const { data: user } = await supabase
      .from('users')
      .select('id, phone')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    if (!user) {
      return res.status(404).json({ message: 'No account found for this email.' });
    }

    const result = await consumeOtp(user.phone, OTP_PURPOSES.RESET_PASSWORD, code);
    if (!result.ok) {
      return res.status(400).json({ message: result.message });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', user.id);

    return res.json({
      message: 'Password updated. You can now sign in with your new password.',
    });
  } catch (error) {
    return next(error);
  }
};

/** GET /api/auth/me */
export const me = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.sub)
      .maybeSingle();
    if (!user) {
      return res.status(404).json({ message: 'Account not found.' });
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
};
