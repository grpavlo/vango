const { Router } = require('express');
const {
  register,
  login,
  sendPhoneCode,
  verifyPhoneCode,
  profile,
  updateProfile,
  updateCustomerProfile,
  updateRole,
  updatePushToken,
  updatePushConsent,
} = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const { profileSelfieOnly } = require('../middlewares/upload');

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/send-code', sendPhoneCode);
router.post('/verify-code', verifyPhoneCode);
router.get('/me', authenticate, profile);
router.put('/profile', authenticate, updateProfile);
router.post('/customer-profile', authenticate, profileSelfieOnly, updateCustomerProfile);
router.put('/role', authenticate, updateRole);
router.put('/push-token', authenticate, updatePushToken);
router.put('/push-consent', authenticate, updatePushConsent);

module.exports = router;
