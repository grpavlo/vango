const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { getBalance, requestWithdrawal } = require('../controllers/financialController');
const { UserRole } = require('../models/user');

const router = Router();

router.get('/balance', authenticate, authorize([UserRole.DRIVER]), getBalance);
router.post('/withdraw', authenticate, authorize([UserRole.DRIVER]), requestWithdrawal);

module.exports = router;
