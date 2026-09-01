const { Router } = require('express');
const {
  loginPortalAdmin,
  sendPortalAdminCode,
  verifyPortalAdminCode,
  portalAdminProfile,
  switchPortalAdminToUser,
} = require('../controllers/adminAuthController');
const { authenticatePortalAdmin } = require('../middlewares/adminAuth');

const router = Router();

router.post('/login', loginPortalAdmin);
router.post('/send-code', sendPortalAdminCode);
router.post('/verify-code', verifyPortalAdminCode);
router.get('/me', authenticatePortalAdmin, portalAdminProfile);
router.post('/switch-to-user', authenticatePortalAdmin, switchPortalAdminToUser);

module.exports = router;
