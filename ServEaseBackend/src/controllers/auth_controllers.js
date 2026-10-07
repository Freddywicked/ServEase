const bcrypt = require('bcryptjs');
const ApiError = require('../utils/api_error');
const asyncHandler = require('../utils/async_handler');
const { signToken } = require('../utils/jwt');
const { validateRegistration } = require('../utils/validators');
const { unwrap } = require('../utils/db');
const { supabase } = require('../config/supabase');
const User = require('../models/user_model');
const otp = require('../services/otp');

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

module.exports = { requestOtp, register, login, me };