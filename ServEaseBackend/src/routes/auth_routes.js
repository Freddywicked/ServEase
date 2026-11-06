const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const auth = require('../controllers/auth_controllers');
const { authenticate } = require('../middleware/auth');

// Brute-force and SMS-credit protection: 30 attempts per IP per 15 minutes across
// the credential/OTP endpoints. The error shape ({ message }) matches what both
// clients already read from failed requests.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in a few minutes.' },
});

router.post('/request-otp', authLimiter, auth.requestOtp);
router.post('/register', authLimiter, auth.register);
router.post('/login', authLimiter, auth.login);
// Google sign-in (web button + native mobile SDK both end up here).
router.post('/google', authLimiter, auth.googleLogin);
// Complete-profile flow for Google users (no phone number from Google).
router.post('/phone/request-otp', authLimiter, authenticate, auth.requestPhoneOtp);
router.post('/phone/verify', authLimiter, authenticate, auth.verifyPhoneOtp);
router.get('/me', authenticate, auth.me);

module.exports = router;