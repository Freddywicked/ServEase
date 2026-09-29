const router = require('express').Router();
const auth = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// TODO: add express-rate-limit to request-otp and login before going live.
router.post('/request-otp', auth.requestOtp);
router.post('/register', auth.register);
router.post('/login', auth.login);
router.get('/me', authenticate, auth.me);

module.exports = router;