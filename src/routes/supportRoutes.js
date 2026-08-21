const { Router } = require('express');
const { authenticate } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const {
  askSupportQuestion,
  askPublicSupportQuestion,
  listMySupportQuestions,
  createSupportQuestion,
  telegramWebhook,
} = require('../controllers/supportController');

const router = Router();

router.post('/telegram/webhook', telegramWebhook);
router.post('/public-ask', askPublicSupportQuestion);
router.post('/ask', authenticate, askSupportQuestion);
router.get('/questions', authenticate, listMySupportQuestions);
router.post('/questions', authenticate, upload.array('photos', 5), createSupportQuestion);

module.exports = router;
