const { Router } = require('express');
const { register, login, profile, updateRole } = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, profile);
router.put('/role', authenticate, updateRole);

module.exports = router;
