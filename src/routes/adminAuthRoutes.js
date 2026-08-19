const { Router } = require('express');
const {
  loginPortalAdmin,
  sendPortalAdminCode,
  verifyPortalAdminCode,
  portalAdminProfile,
} = require('../controllers/adminAuthController');
const { authenticatePortalAdmin } = require('../middlewares/adminAuth');

const router = Router();

router.post('/login', loginPortalAdmin);
router.post('/send-code', sendPortalAdminCode);
router.post('/verify-code', verifyPortalAdminCode);
router.get('/me', authenticatePortalAdmin, portalAdminProfile);

module.exports = router;
