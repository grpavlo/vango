const { Router } = require('express');
const { authenticate } = require('../middlewares/auth');
const {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notificationController');

const router = Router();

router.get('/', authenticate, listNotifications);
router.put('/read-all', authenticate, markAllNotificationsRead);
router.put('/:id/read', authenticate, markNotificationRead);

module.exports = router;
