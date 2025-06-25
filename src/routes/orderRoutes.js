const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const {
  createOrder,
  listAvailableOrders,
  reserveOrder,
  cancelReserve,
  acceptOrder,
  confirmDriver,
  rejectDriver,
  updateStatus,
  listMyOrders,
  updateOrder,
  deleteOrder,
} = require('../controllers/orderController');
const { UserRole } = require('../models/user');

const router = Router();

router.post('/', authenticate, authorize([UserRole.CUSTOMER]), upload.array('photos', 10), createOrder);
router.get('/', authenticate, authorize([UserRole.DRIVER]), listAvailableOrders);
router.post('/:id/reserve', authenticate, authorize([UserRole.DRIVER]), reserveOrder);
router.post('/:id/cancel-reserve', authenticate, authorize([UserRole.DRIVER, UserRole.CUSTOMER]), cancelReserve);
router.get('/my', authenticate, listMyOrders);
router.post('/:id/accept', authenticate, authorize([UserRole.DRIVER]), acceptOrder);
router.post('/:id/confirm-driver', authenticate, authorize([UserRole.CUSTOMER]), confirmDriver);
router.post('/:id/reject-driver', authenticate, authorize([UserRole.CUSTOMER]), rejectDriver);
router.patch('/:id/status', authenticate, updateStatus);
router.patch('/:id', authenticate, authorize([UserRole.CUSTOMER]), upload.array('photos', 10), updateOrder);
router.delete('/:id', authenticate, authorize([UserRole.CUSTOMER]), deleteOrder);

module.exports = router;
