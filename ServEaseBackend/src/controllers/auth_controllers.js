const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/jwt');
const { validateRegistration } = require('../utils/validators');
const User = require('../models/user.model');
const otp = require('../services/otp'); // adjust the two calls below to match what your otp.js exports

// BR-01: one account per email (usernames are unique too).
const assertAvailable = async ({ email, username }) => {
  if (await User.findByEmail(email, 'user_id')) throw new ApiError(409, 'Email is already registered');
  if (await User.findByUsername(username, 'user_id')) throw new ApiError(409, 'Username is already taken');
};

// Sign-up step 1: validate the form, then email an OTP. Nothing is saved yet.
const requestOtp = asyncHandler(async (req, res) => {
  const data = validateRegistration(req.body);
  await assertAvailable(data);
  await otp.sendOtp(data.email);
  res.json({ message: 'OTP sent to your email' });
});

// Sign-up step 2: the app sends the same form again plus the OTP.
// The account (default role: customer, BR-02) is only created if the OTP is valid.
const register = asyncHandler(async (req, res) => {
  const data = validateRegistration(req.body);
  if (!req.body.otp) throw new ApiError(400, 'OTP is required');
  await assertAvailable(data);

  const valid = await otp.verifyOtp(data.email, String(req.body.otp));
  if (!valid) throw new ApiError(400, 'Invalid or expired OTP');

  const password = await bcrypt.hash(data.password, 10);
  const user = await User.createCustomer({ ...data, password });

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
  const valid = user && (await bcrypt.compare(String(password), user.password));
  if (!valid) throw new ApiError(401, 'Invalid credentials');

  res.json({ token: signToken(user), user: User.toPublic(user) });
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