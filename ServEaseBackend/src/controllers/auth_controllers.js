const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const ApiError = require('../utils/api_error');
const asyncHandler = require('../utils/async_handler');
const { signToken } = require('../utils/jwt');
const { validateRegistration } = require('../utils/validators');
const { unwrap } = require('../utils/db');
const { supabase } = require('../config/supabase');
const config = require('../config');
const User = require('../models/user_model');
const otp = require('../services/otp');

const googleClient = new OAuth2Client();
const PHONE_RE = /^(09|\+639)\d{9}$/; // same rule as utils/validators.js

// BR-01: one account per email.
const assertEmailAvailable = async (email) => {
  if (await User.findByEmail(email, 'user_id')) throw new ApiError(409, 'Email is already registered');
};

// One account per phone number. Checks both "+639..." and older "09..." rows,
// so the user finds out BEFORE an OTP is sent/used, not after.
const assertPhoneAvailable = async (phoneE164) => {
  const variants = [phoneE164, `0${phoneE164.slice(3)}`]; // +639XXXXXXXXX, 09XXXXXXXXX
  const rows = unwrap(
    await supabase.from('users').select('user_id').in('phone_number', variants).limit(1)
  );
  if (rows && rows.length) throw new ApiError(409, 'Phone number is already registered');
};

// The signup screens don't collect a username, so derive one from the email
// (e.g. "ana@mail.com" -> "ana", or "ana2" if "ana" is already taken).
const usernameFromEmail = (email) =>
  email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'user';

const generateUsername = async (email) => {
  const base = usernameFromEmail(email);
  let candidate = base;
  let suffix = 1;
  while (await User.findByUsername(candidate, 'user_id')) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
};

// Sign-up step 1: validate the form, then text an OTP to the phone number.
// Nothing is saved to users yet.
const requestOtp = asyncHandler(async (req, res) => {
  const data = validateRegistration(req.body);
  await assertEmailAvailable(data.email);
  await assertPhoneAvailable(data.phone_number);
  await otp.sendOtp({ email: data.email, phone: data.phone_number });
  res.json({ message: 'OTP sent to your phone number' });
});

// Sign-up step 2: the app sends the same form again plus the OTP.
// The account (default role: customer, BR-02) is only created if the OTP is valid.
const register = asyncHandler(async (req, res) => {
  const data = validateRegistration(req.body);
  const code = String(req.body.otp ?? '').trim();
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, 'Please enter the 6-digit code');

  await assertEmailAvailable(data.email);
  await assertPhoneAvailable(data.phone_number);

  const valid = await otp.verifyOtp(data.email, code, data.phone_number);
  if (!valid) throw new ApiError(400, 'Invalid or expired OTP');

  const username = await generateUsername(data.email);
  const { password, ...fields } = data; // never store the plain password
  const password_hash = await bcrypt.hash(password, 10);
  const user = await User.createCustomer({ ...fields, username, password_hash });

  res.status(201).json({ token: signToken(user), user });
});

// Login with email OR username + password.
const login = asyncHandler(async (req, res) => {
  const identifier = String(req.body.email || req.body.username || '').trim().toLowerCase();
  const { password } = req.body;
  if (!identifier || !password) throw new ApiError(400, 'Email/username and password are required');

  const user = identifier.includes('@')
    ? await User.findByEmail(identifier)
    : await User.findByUsername(identifier);

  // Same message whether the account or the password is wrong.
  const valid = user && (await bcrypt.compare(String(password), user.password_hash));
  if (!valid) throw new ApiError(401, 'Invalid credentials');

  // Checked after the password so the message can't be used to probe which accounts exist.
  if (user.is_disabled) throw new ApiError(403, 'This account has been disabled. Please contact support.');

  const provider = await User.findProvider(user.user_id);
  res.json({
    token: signToken(user),
    user: User.toPublic(user),
    provider: provider ? { verification_status: provider.verification_status } : null,
  });
});

// Who am I? Also tells the app whether this user has applied as a provider.
const me = asyncHandler(async (req, res) => {
  const provider = await User.findProvider(req.user.user_id);
  res.json({
    user: req.user,
    provider: provider ? { verification_status: provider.verification_status } : null,
  });
});

// Sign in (or sign up) with Google. Two token kinds are accepted, so both apps can
// use their natural SDK flow while sharing this endpoint:
//   - id_token     (mobile): @react-native-google-signin hands us Google's ID token,
//                  verified with verifyIdToken against our own client IDs.
//   - access_token (web): the custom gradient button on Login.jsx uses useGoogleLogin
//                  (implicit popup flow), which returns an access token instead. We
//                  verify its audience via tokeninfo, then read sub/email/name from
//                  Google's userinfo endpoint.
// Either way we find-or-create the user and return the SAME response shape as
// /login, so both apps reuse their existing session handling.
const googleLogin = asyncHandler(async (req, res) => {
  if (!config.google.clientIds.length) {
    throw new ApiError(500, 'Google sign-in is not configured on the server');
  }
  const idToken = String(req.body.id_token || '').trim();
  const accessToken = String(req.body.access_token || '').trim();
  if (!idToken && !accessToken) throw new ApiError(400, 'id_token or access_token is required');

  let payload;
  try {
    if (idToken) {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: config.google.clientIds, // only tokens issued for OUR app pass
      });
      payload = ticket.getPayload();
    } else {
      // tokeninfo proves the access token was issued for OUR client (audience check);
      // userinfo (called WITH the token, so it can't be forged) gives the profile.
      const info = await googleClient.getTokenInfo(accessToken);
      if (!config.google.clientIds.includes(info.aud)) throw new Error('unexpected audience');
      const profileClient = new OAuth2Client();
      profileClient.setCredentials({ access_token: accessToken });
      const { data } = await profileClient.request({
        url: 'https://www.googleapis.com/oauth2/v3/userinfo',
      });
      payload = {
        sub: data.sub,
        email: data.email,
        email_verified: data.email_verified === true || data.email_verified === 'true',
        name: data.name,
      };
    }
  } catch {
    throw new ApiError(401, 'Google sign-in failed. Please try again.');
  }

  // Never trust a token whose email Google itself hasn't verified — without this,
  // anyone could mint a token claiming somebody else's email address.
  if (!payload?.email || payload.email_verified !== true) {
    throw new ApiError(401, 'Your Google account email is not verified');
  }
  const email = payload.email.toLowerCase();

  // 1) Known Google account -> log in.
  let user = await User.findByGoogleId(payload.sub);
  if (!user) {
    // 2) Same email already registered with a password -> link the two (safe:
    //    Google verified the address, so it's the same person; BR-01 holds).
    const existing = await User.findByEmail(email);
    if (existing) {
      await User.linkGoogleId(existing.user_id, payload.sub);
      user = existing;
    } else {
      // 3) Brand-new account (customer, BR-02). Google provides no phone/address/
      //    birthdate/gender, so those stay NULL (migrations/008) and the client
      //    collects the phone number next (see needs_phone below).
      const username = await generateUsername(email);
      user = await User.createCustomer({
        name: String(payload.name || username).trim().slice(0, 100) || username,
        email,
        username,
        google_id: payload.sub,
      });
    }
  }

  if (user.is_disabled) throw new ApiError(403, 'This account has been disabled. Please contact support.');

  const provider = await User.findProvider(user.user_id);
  res.json({
    token: signToken(user),
    user: User.toPublic(user),
    provider: provider ? { verification_status: provider.verification_status } : null,
    // Tells the client to open the complete-profile screen (phone + OTP).
    needs_phone: !user.phone_number,
  });
});

// Complete-profile step 1 (Google users): text an OTP to the phone number they
// want to attach to their account. Authenticated; the OTP is keyed to THEIR email.
const requestPhoneOtp = asyncHandler(async (req, res) => {
  const phone = String(req.body.phone_number || '').trim().replace(/[\s-]/g, '');
  if (!PHONE_RE.test(phone)) throw new ApiError(400, 'Enter a valid PH mobile number');
  const phoneE164 = phone.startsWith('09') ? `+63${phone.slice(1)}` : phone;

  await assertPhoneAvailable(phoneE164);
  await otp.sendOtp({ email: req.user.email, phone: phoneE164 });
  res.json({ message: 'OTP sent to your phone number' });
});

// Complete-profile step 2: a valid OTP attaches the phone number to the account.
const verifyPhoneOtp = asyncHandler(async (req, res) => {
  const phone = String(req.body.phone_number || '').trim().replace(/[\s-]/g, '');
  const code = String(req.body.otp ?? '').trim();
  if (!PHONE_RE.test(phone)) throw new ApiError(400, 'Enter a valid PH mobile number');
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, 'Please enter the 6-digit code');
  const phoneE164 = phone.startsWith('09') ? `+63${phone.slice(1)}` : phone;

  await assertPhoneAvailable(phoneE164);
  const valid = await otp.verifyOtp(req.user.email, code, phoneE164);
  if (!valid) throw new ApiError(400, 'Invalid or expired OTP');

  const user = await User.setPhoneNumber(req.user.user_id, phoneE164);
  res.json({ message: 'Phone number verified', user });
});

module.exports = { requestOtp, register, login, me, googleLogin, requestPhoneOtp, verifyPhoneOtp };