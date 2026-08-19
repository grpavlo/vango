const { answerSupportQuestion } = require('../services/supportBot');
const SupportQuestion = require('../models/supportQuestion');
const { notifySupportQuestionCreated } = require('../services/supportNotifications');

async function askSupportQuestion(req, res) {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';

  if (question.length < 2) {
    return res.status(400).json({ error: 'Напишіть питання трохи детальніше.' });
  }

  if (question.length > 800) {
    return res.status(400).json({ error: 'Питання занадто довге. Скоротіть його, будь ласка.' });
  }

  try {
    const result = await answerSupportQuestion({
      question,
      role: req.user?.role,
    });
    return res.json(result);
  } catch {
    return res.status(500).json({
      error: 'Не вдалося підготувати відповідь. Спробуйте ще раз трохи пізніше.',
    });
  }
}

async function listMySupportQuestions(req, res) {
  const items = await SupportQuestion.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  res.json(items);
}

async function createSupportQuestion(req, res) {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';

  if (question.length < 5) {
    return res.status(400).json({ error: 'Опишіть питання трохи детальніше.' });
  }

  if (question.length > 1200) {
    return res.status(400).json({ error: 'Питання занадто довге. Скоротіть його, будь ласка.' });
  }

  const item = await SupportQuestion.create({
    userId: req.user.id,
    question,
  });

  const created = await SupportQuestion.findByPk(item.id, {
    include: [
      {
        association: 'user',
        attributes: ['id', 'name', 'firstName', 'lastName', 'phone', 'email', 'role'],
      },
    ],
  });

  notifySupportQuestionCreated(created).catch(() => {});

  return res.status(201).json({
    id: item.id,
    status: item.status,
    message:
      'Питання передано розробникам. Ви отримаєте відповідь у застосунку найближчим часом.',
  });
}

module.exports = {
  askSupportQuestion,
  listMySupportQuestions,
  createSupportQuestion,
};
