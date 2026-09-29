const ApiError = require('./ApiError');

// supabase-js returns { data, error } instead of throwing.
// Wrap every query: const rows = unwrap(await supabase.from('x').select());
const unwrap = ({ data, error }) => {
  if (error) {
    if (error.code === '23505') throw new ApiError(409, 'That record already exists');
    if (error.code === '23503') throw new ApiError(400, 'A related record does not exist');
    console.error('[supabase]', error);
    throw new ApiError(500, 'Database error');
  }
  return data;
};

module.exports = { unwrap };