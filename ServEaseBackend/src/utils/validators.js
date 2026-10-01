const ApiError = require('./api_error');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(09|\+639)\d{9}$/; // PH mobile: 09XXXXXXXXX or +639XXXXXXXXX
const MIN_BIRTHDATE = '1900-01-01';

// The exact values saved in users.gender. Input is matched case-insensitively,
// so "male", "Male" and "MALE" all work.
// >>> If your gender column stores 'Male'/'Female', change these two strings. <<<
const GENDERS = ['male', 'female'];

// Always store one phone format: +639XXXXXXXXX
const toPhE164 = (phone) => (phone.startsWith('09') ? `+63${phone.slice(1)}` : phone);

// Accepts YYYY-MM-DD (mobile, <input type="date">) or MM/DD/YYYY.
// Returns YYYY-MM-DD, or '' if it isn't a real calendar date (e.g. 2000-02-31).
const toIsoDate = (value) => {
  const s = String(value ?? '').trim();
  let y;
  let m;
  let d;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) {
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return '';
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

// "Today" in the Philippines, so a birthdate isn't wrongly flagged as future around midnight.
const todayInManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

const validateRegistration = (body = {}) => {
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  // Strip spaces/dashes so "+63 912 345 6789" passes just like "+639123456789".
  const phone_number = String(body.phone_number ?? '').trim().replace(/[\s-]/g, '');
  const password = String(body.password ?? '');
  const address = String(body.address ?? '').trim();
  const birthdate = toIsoDate(body.birthdate);
  const genderInput = String(body.gender ?? '').trim().toLowerCase();
  const gender = GENDERS.find((g) => g.toLowerCase() === genderInput);

  const errors = {};
  if (!name) errors.name = 'Name is required';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
  if (!PHONE_RE.test(phone_number)) errors.phone_number = 'Enter a valid PH mobile number';
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Use at least 8 characters with letters and numbers';
  }
  if (!address) errors.address = 'Address is required';

  if (!body.birthdate) errors.birthdate = 'Birthdate is required';
  else if (!birthdate || birthdate < MIN_BIRTHDATE) errors.birthdate = 'Enter a valid date';
  else if (birthdate > todayInManila()) errors.birthdate = 'Birthdate cannot be in the future';

  if (!genderInput) errors.gender = 'Gender is required';
  else if (!gender) errors.gender = 'Select a valid gender';

  if (Object.keys(errors).length) throw new ApiError(400, 'Please fix the highlighted fields', errors);

  // Only whitelisted fields go to the database (never spread req.body into an insert,
  // or someone can send role: "admin").
  return {
    name,
    email,
    phone_number: toPhE164(phone_number),
    password,
    address,
    birthdate,
    gender,
  };
};

module.exports = { validateRegistration };