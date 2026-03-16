const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth');
const { UserRole } = require('../models/user');
const controller = require('../controllers/savedSearchController');

router.use(authenticate, authorize([UserRole.DRIVER]));

router.get('/', controller.listSavedSearches);
router.post('/', controller.createSavedSearch);
router.delete('/:id', controller.deleteSavedSearch);

module.exports = router;
