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
  getOrder,
  updateOrder,
  deleteOrder,
  updateFinalPrice,
  respondToOrder,
  getMyResponse,
  responseCallMade,
  responseResult,
  responseConfirm,
  responseReject,
  responseWithdraw,
  getOrderResponses,
} = require('../controllers/orderController');
const { UserRole } = require('../models/user');

const router = Router();

router.post('/', authenticate, authorize([UserRole.CUSTOMER]), upload.array('photos', 10), createOrder);
router.get('/', authenticate, authorize([UserRole.DRIVER]), listAvailableOrders);
router.post('/:id/reserve', authenticate, authorize([UserRole.DRIVER]), reserveOrder);
router.post('/:id/cancel-reserve', authenticate, authorize([UserRole.DRIVER, UserRole.CUSTOMER]), cancelReserve);
router.get('/my', authenticate, listMyOrders);
router.get('/:id', authenticate, getOrder);
router.post('/:id/accept', authenticate, authorize([UserRole.DRIVER]), acceptOrder);
router.post('/:id/confirm-driver', authenticate, authorize([UserRole.CUSTOMER]), confirmDriver);
router.post('/:id/reject-driver', authenticate, authorize([UserRole.CUSTOMER]), rejectDriver);
router.patch('/:id/status', authenticate, upload.single('statusPhoto'), updateStatus);
router.patch('/:id', authenticate, authorize([UserRole.CUSTOMER]), upload.array('photos', 10), updateOrder);
router.delete('/:id', authenticate, authorize([UserRole.CUSTOMER]), deleteOrder);
router.post("/:id/final-price", authenticate, authorize([UserRole.CUSTOMER]), updateFinalPrice);

// New response flow routes
router.post('/:id/respond', authenticate, authorize([UserRole.DRIVER]), respondToOrder);
router.get('/:id/respond/mine', authenticate, authorize([UserRole.DRIVER]), getMyResponse);
router.post('/:id/respond/:responseId/call-made', authenticate, authorize([UserRole.DRIVER]), responseCallMade);
router.post('/:id/respond/:responseId/result', authenticate, authorize([UserRole.DRIVER]), responseResult);
router.post('/:id/respond/:responseId/confirm', authenticate, authorize([UserRole.CUSTOMER]), responseConfirm);
router.post('/:id/respond/:responseId/reject', authenticate, authorize([UserRole.CUSTOMER]), responseReject);
router.delete('/:id/respond/:responseId', authenticate, authorize([UserRole.DRIVER]), responseWithdraw);
router.get('/:id/responses', authenticate, authorize([UserRole.CUSTOMER]), getOrderResponses);

module.exports = router;
