const { Router } = require('express');
const {
  register,
  login,
  profile,
  updateRole,
  updatePushToken,
  updatePushConsent,
  testPush,
} = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, profile);
router.put('/role', authenticate, updateRole);
router.put('/push-token', authenticate, updatePushToken);
router.put('/push-consent', authenticate, updatePushConsent);
router.post('/push-test', authenticate, testPush);

module.exports = router;
