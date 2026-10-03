const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const users = require('../controllers/user_controllers');

// PATCH /api/users/me — body: { activeMode: 'customer' | 'service_provider' }
router.patch('/me', authenticate, users.updateMe);

module.exports = router;