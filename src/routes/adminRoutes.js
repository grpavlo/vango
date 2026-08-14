const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const {
  listUsers,
  listOrders,
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  updateUserGroup,
  blockDriver,
  unblockDriver,
  updateServiceFee,
  analytics,
  analyticsOverview,
  analyticsGmv,
  analyticsActiveUsers,
  analyticsLiquidity,
  analyticsRetention,
} = require('../controllers/adminController');
const { UserRole } = require('../models/user');

const router = Router();

router.get('/users', authenticate, authorize([UserRole.ADMIN]), listUsers);
router.get('/orders', authenticate, authorize([UserRole.ADMIN]), listOrders);
router.get('/groups', authenticate, authorize([UserRole.ADMIN]), listGroups);
router.post('/groups', authenticate, authorize([UserRole.ADMIN]), upload.single('photo'), createGroup);
router.patch('/groups/:id', authenticate, authorize([UserRole.ADMIN]), upload.single('photo'), updateGroup);
router.delete('/groups/:id', authenticate, authorize([UserRole.ADMIN]), deleteGroup);
router.patch('/users/:id/group', authenticate, authorize([UserRole.ADMIN]), updateUserGroup);
router.post('/users/:id/block', authenticate, authorize([UserRole.ADMIN]), blockDriver);
router.post('/users/:id/unblock', authenticate, authorize([UserRole.ADMIN]), unblockDriver);
router.post('/drivers/:id/block', authenticate, authorize([UserRole.ADMIN]), blockDriver);
router.post('/drivers/:id/unblock', authenticate, authorize([UserRole.ADMIN]), unblockDriver);
router.post('/service-fee', authenticate, authorize([UserRole.ADMIN]), updateServiceFee);
router.get('/analytics', authenticate, authorize([UserRole.ADMIN]), analytics);
router.get('/analytics/overview', authenticate, authorize([UserRole.ADMIN]), analyticsOverview);
router.get('/analytics/gmv', authenticate, authorize([UserRole.ADMIN]), analyticsGmv);
router.get('/analytics/active-users', authenticate, authorize([UserRole.ADMIN]), analyticsActiveUsers);
router.get('/analytics/liquidity', authenticate, authorize([UserRole.ADMIN]), analyticsLiquidity);
router.get('/analytics/retention', authenticate, authorize([UserRole.ADMIN]), analyticsRetention);

module.exports = router;
