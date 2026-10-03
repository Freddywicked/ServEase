const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const admin = require('../controllers/admin_controllers');

// Only accounts with role "admin" may use these routes.
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: { message: 'Admin access only' } });
  }
  next();
};

router.get('/stats', authenticate, requireAdmin, admin.getStats);

router.get('/users', authenticate, requireAdmin, admin.getUsers);
router.get('/users/:id/documents/:kind', authenticate, requireAdmin, admin.getDocuments);
router.patch('/users/:id/approve', authenticate, requireAdmin, admin.approveApplication);
router.patch('/users/:id/reject', authenticate, requireAdmin, admin.rejectApplication);
router.patch('/users/:id/disable', authenticate, requireAdmin, admin.disableUser);
router.patch('/users/:id/enable', authenticate, requireAdmin, admin.enableUser);

module.exports = router;