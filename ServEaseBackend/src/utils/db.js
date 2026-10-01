const ApiError = require('./api_error');

const DUPLICATE_MESSAGES = {
  email: 'Email is already registered',
  phone_number: 'Phone number is already registered',
  username: 'Username is already taken',
};

// Postgres error codes that are the user's fault (400), not a server crash (500).
const PG_ERRORS = {
  '23503': [400, 'A related record does not exist'],
  '23502': [400, 'A required field is missing'],
  '23514': [400, 'One of the values is not allowed'], // CHECK constraint
  '22P02': [400, 'One of the values has an invalid format'], // bad enum / uuid
  '22007': [400, 'Invalid date format'],
  '22008': [400, 'Invalid date'],
};

// supabase-js returns { data, error } instead of throwing.
// Wrap every query: const rows = unwrap(await supabase.from('x').select());
const unwrap = ({ data, error }) => {
  if (!error) return data;

  if (error.code === '23505') {
    // details look like: Key (phone_number)=(+639...) already exists.
    const column = /Key \((\w+)\)/.exec(error.details || '')?.[1];
    throw new ApiError(409, DUPLICATE_MESSAGES[column] || 'That record already exists');
  }

  const known = PG_ERRORS[error.code];
  if (known) {
    console.warn('[supabase]', error.code, error.message);
    throw new ApiError(known[0], known[1]);
  }

  console.error('[supabase]', error);
  throw new ApiError(500, 'Database error');
};

module.exports = { unwrap };