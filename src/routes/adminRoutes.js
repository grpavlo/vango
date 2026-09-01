const { Router } = require('express');
const { authenticateAdminAccess } = require('../middlewares/adminAuth');
const { upload } = require('../middlewares/upload');
const {
  listUsers,
  listPortalAdmins,
  createPortalAdmin,
  updatePortalAdmin,
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
  analyticsOrderReport,
  analyticsGmv,
  analyticsActiveUsers,
  analyticsLiquidity,
  analyticsRetention,
  listSupportQuestions,
  updateSupportQuestion,
} = require('../controllers/adminController');

const router = Router();

router.use(authenticateAdminAccess);

router.get('/users', listUsers);
router.get('/portal-admins', listPortalAdmins);
router.post('/portal-admins', createPortalAdmin);
router.patch('/portal-admins/:id', updatePortalAdmin);
router.get('/orders', listOrders);
router.get('/groups', listGroups);
router.post('/groups', upload.single('photo'), createGroup);
router.patch('/groups/:id', upload.single('photo'), updateGroup);
router.delete('/groups/:id', deleteGroup);
router.patch('/users/:id/group', updateUserGroup);
router.post('/users/:id/block', blockDriver);
router.post('/users/:id/unblock', unblockDriver);
router.post('/drivers/:id/block', blockDriver);
router.post('/drivers/:id/unblock', unblockDriver);
router.post('/service-fee', updateServiceFee);
router.get('/support-questions', listSupportQuestions);
router.patch('/support-questions/:id', updateSupportQuestion);
router.get('/analytics', analytics);
router.get('/analytics/overview', analyticsOverview);
router.get('/analytics/order-report', analyticsOrderReport);
router.get('/analytics/gmv', analyticsGmv);
router.get('/analytics/active-users', analyticsActiveUsers);
router.get('/analytics/liquidity', analyticsLiquidity);
router.get('/analytics/retention', analyticsRetention);

module.exports = router;
