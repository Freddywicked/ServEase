const ApiError = require('../utils/api_error');
const asyncHandler = require('../utils/async_handler');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/user_model');

// Must match the value you store in service_providers.verification_status
// once an admin approves a provider (BR-04 / BR-05).
const VERIFIED = 'verified';

// Checks the Bearer token and loads the user, so role changes and deleted accounts apply immediately.
// Every registered user is a customer (BR-02), so this is also your "customer only" guard.
const authenticate = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Authentication required');

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new ApiError(401, 'Session expired, please log in again');
    if (err.name === 'JsonWebTokenError') throw new ApiError(401, 'Invalid token');
    throw err; // e.g. JWT_SECRET missing is a server problem, not a 401
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'Account no longer exists');

  req.user = user;
  next();
});

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return next(new ApiError(403, 'Admins only'));
  next();
};

// For routes only verified providers may use (BR-05). Use after `authenticate`.
const requireVerifiedProvider = asyncHandler(async (req, res, next) => {
  const provider = await User.findProvider(req.user.user_id);
  if (!provider) throw new ApiError(403, 'Provider account required');
  if (provider.verification_status !== VERIFIED) {
    throw new ApiError(403, 'Your provider account is still pending verification');
  }
  req.provider = provider;
  next();
});

module.exports = { authenticate, requireAdmin, requireVerifiedProvider };