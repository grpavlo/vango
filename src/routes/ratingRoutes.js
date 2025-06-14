const { Router } = require('express');
const { authenticate } = require('../middlewares/auth');
const { rateUser } = require('../controllers/ratingController');

const router = Router();

router.post('/', authenticate, rateUser);

module.exports = router;
