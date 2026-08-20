const { Router } = require('express');
const { authenticate } = require('../middlewares/auth');
const {
  askSupportQuestion,
  listMySupportQuestions,
  createSupportQuestion,
  telegramWebhook,
} = require('../controllers/supportController');

const router = Router();

router.post('/telegram/webhook', telegramWebhook);
router.post('/ask', authenticate, askSupportQuestion);
router.get('/questions', authenticate, listMySupportQuestions);
router.post('/questions', authenticate, createSupportQuestion);

module.exports = router;
