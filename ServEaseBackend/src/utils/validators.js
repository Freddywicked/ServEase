const ApiError = require('./ApiError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const PHONE_RE = /^(09|\+639)\d{9}$/; // PH mobile: 09XXXXXXXXX or +639XXXXXXXXX

const validateRegistration = (body = {}) => {
  const name = String(body.name ?? '').trim();
  const username = String(body.username ?? '').trim().toLowerCase();
  const email = String(body.email ?? '').trim().toLowerCase();
  const phone_number = String(body.phone_number ?? '').trim();
  const password = String(body.password ?? '');

  const errors = {};
  if (!name) errors.name = 'Name is required';
  if (!USERNAME_RE.test(username)) errors.username = 'Use 3-30 letters, numbers or underscores';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
  if (!PHONE_RE.test(phone_number)) errors.phone_number = 'Enter a valid PH mobile number';
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Use at least 8 characters with letters and numbers';
  }
  if (body.birthdate && Number.isNaN(Date.parse(body.birthdate))) {
    errors.birthdate = 'Enter a valid date';
  }
  if (Object.keys(errors).length) throw new ApiError(400, 'Please fix the highlighted fields', errors);

  // Only whitelisted fields go to the database (never spread req.body into an insert,
  // or someone can send role: "admin").
  const clean = { name, username, email, phone_number, password };
  if (body.address) clean.address = String(body.address).trim();
  if (body.birthdate) clean.birthdate = body.birthdate;
  if (body.gender) clean.gender = String(body.gender).trim();
  return clean;
};

module.exports = { validateRegistration };