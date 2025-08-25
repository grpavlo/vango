const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { UserRole } = require('../models/user');
const { rateUser } = require('../controllers/ratingController');

const router = Router();

router.post(
  '/',
  authenticate,
  authorize([UserRole.DISPATCHER, UserRole.ADMIN, UserRole.TEAMLEAD]),
  rateUser
);

module.exports = router;
