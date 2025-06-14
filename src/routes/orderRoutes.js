const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { createOrder, listAvailableOrders, acceptOrder, updateStatus } = require('../controllers/orderController');
const { UserRole } = require('../models/user');

const router = Router();

router.post('/', authenticate, authorize([UserRole.CUSTOMER]), createOrder);
router.get('/', authenticate, authorize([UserRole.DRIVER]), listAvailableOrders);
router.post('/:id/accept', authenticate, authorize([UserRole.DRIVER]), acceptOrder);
router.patch('/:id/status', authenticate, updateStatus);

module.exports = router;
