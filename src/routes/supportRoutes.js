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

// Public answers reuse the bot's knowledge, without calling the paid AI service.
router.get('/faq', (_req, res) => {
  const { KNOWLEDGE_BASE } = require('../services/supportBot');
  const titles = {
    'what-is-vango': 'Що таке VanGo?',
    'phone-format': 'У якому форматі вводити номер телефону?',
    'sms-not-received': 'Не прийшло SMS з кодом. Що робити?',
    notifications: 'Чому немає сповіщень?',
    'create-order': 'Як створити замовлення?',
    'cannot-create-order': 'Не вдається створити замовлення',
    'search-orders': 'Як шукати замовлення?',
    'driver-orders': 'Чому я не бачу замовлення?',
    roles: 'Як змінити роль у застосунку?',
    'app-error': 'Що робити, якщо застосунок показує помилку?',
  };
  res.json(KNOWLEDGE_BASE.filter((item) => titles[item.id]).map((item) => ({
    id: item.id, question: titles[item.id], answer: item.answer,
  })));
});

router.post('/telegram/webhook', telegramWebhook);
router.post('/public-ask', askPublicSupportQuestion);
router.post('/ask', authenticate, askSupportQuestion);
router.get('/questions', authenticate, listMySupportQuestions);
router.post('/questions', authenticate, upload.array('photos', 5), createSupportQuestion);

module.exports = router;
