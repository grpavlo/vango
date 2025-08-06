const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const {
  listUsers,
  blockDriver,
  unblockDriver,
  updateServiceFee,
  analytics,
  listSessions,
  terminateSession,
} = require('../controllers/adminController');
const { UserRole } = require('../models/user');

const router = Router();

router.get('/users', authenticate, authorize([UserRole.ADMIN]), listUsers);
router.post('/drivers/:id/block', authenticate, authorize([UserRole.ADMIN]), blockDriver);
router.post('/drivers/:id/unblock', authenticate, authorize([UserRole.ADMIN]), unblockDriver);
router.post('/service-fee', authenticate, authorize([UserRole.ADMIN]), updateServiceFee);
router.get('/analytics', authenticate, authorize([UserRole.ADMIN]), analytics);
router.get('/users/:id/sessions', authenticate, authorize([UserRole.ADMIN]), listSessions);
router.delete(
  '/users/:id/sessions/:sessionId',
  authenticate,
  authorize([UserRole.ADMIN]),
  terminateSession
);

module.exports = router;
