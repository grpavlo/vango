const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const {
  createOrder,
  listAvailableOrders,
  acceptOrder,
  updateStatus,
  listMyOrders,
  deleteOrder,
} = require('../controllers/orderController');
const { UserRole } = require('../models/user');

const router = Router();

router.post('/', authenticate, authorize([UserRole.CUSTOMER]), upload.array('photos', 10), createOrder);
router.get('/', authenticate, authorize([UserRole.DRIVER]), listAvailableOrders);
router.get('/my', authenticate, listMyOrders);
router.post('/:id/accept', authenticate, authorize([UserRole.DRIVER]), acceptOrder);
router.patch('/:id/status', authenticate, updateStatus);
router.delete('/:id', authenticate, authorize([UserRole.CUSTOMER]), deleteOrder);

module.exports = router;
