const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { listUsers, blockDriver, unblockDriver, updateServiceFee, analytics, sendPush } = require('../controllers/adminController');
const { UserRole } = require('../models/user');

const router = Router();

router.get('/users', authenticate, authorize([UserRole.ADMIN]), listUsers);
router.post('/drivers/:id/block', authenticate, authorize([UserRole.ADMIN]), blockDriver);
router.post('/drivers/:id/unblock', authenticate, authorize([UserRole.ADMIN]), unblockDriver);
router.post('/service-fee', authenticate, authorize([UserRole.ADMIN]), updateServiceFee);
router.get('/analytics', authenticate, authorize([UserRole.ADMIN]), analytics);
router.post(
  '/push',
  authenticate,
  authorize([UserRole.ADMIN]),
  (req, res) => {
    const secret = req.headers['x-admin-secret'];
    if (secret !== (process.env.ADMIN_SECRET || 'secret')) {
      return res.status(403).send('Доступ заборонено');
    }
    return sendPush(req, res);
  }
);


module.exports = router;
