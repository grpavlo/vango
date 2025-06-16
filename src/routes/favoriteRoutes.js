const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const controller = require('../controllers/favoriteController');

router.use(authenticate);

router.get('/', controller.listFavorites);
router.post('/:driverId', controller.addFavorite);
router.delete('/:driverId', controller.removeFavorite);

module.exports = router;
