const { answerSupportQuestion } = require('../services/supportBot');
const SupportQuestion = require('../models/supportQuestion');
const { SupportQuestionStatus } = require('../models/supportQuestion');
const User = require('../models/user');
const {
  getTelegramConfig,
  notifySupportQuestionCreated,
  sendTelegramMessage,
} = require('../services/supportNotifications');
const { sendPush } = require('../utils/push');
const { cleanupUploadUrls, pathToUploadUrl } = require('../utils/uploadFiles');

function getTelegramMessage(update) {
  return update?.message || update?.edited_message || null;
}

function parseTelegramAnswerCommand(text) {
  const match = String(text || '').match(/^\/(?:answer|reply)(?:@\w+)?\s+(\d+)\s+([\s\S]+)$/i);
  if (!match) return null;
  return {
    id: Number.parseInt(match[1], 10),
    answer: String(match[2] || '').trim(),
  };
}

function parseSupportQuestionId(text) {
  const match = String(text || '').match(/(?:^|\n)ID:\s*(\d+)(?:\D|$)/i);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function parseTelegramReplyAnswer(message) {
  const answer = String(message?.text || '').trim();
  const repliedText = message?.reply_to_message?.text || message?.reply_to_message?.caption || '';
  const id = parseSupportQuestionId(repliedText);
  if (!id) return null;
  return { id, answer };
}

function getTelegramMessageOptions(message) {
  return {
    chatId: message?.chat?.id,
    replyToMessageId: message?.message_id,
    messageThreadId: message?.message_thread_id,
  };
}

async function notifySupportAnswerUser(item, answer) {
  const user = await User.findByPk(item.userId);
  if (user?.pushToken && user.pushConsent) {
    await sendPush(
      user.pushToken,
      '\u0412\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u044c \u0432\u0456\u0434 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u043a\u0438 VanGo',
      '\u0420\u043e\u0437\u0440\u043e\u0431\u043d\u0438\u043a\u0438 \u0432\u0456\u0434\u043f\u043e\u0432\u0456\u043b\u0438 \u043d\u0430 \u0432\u0430\u0448\u0435 \u043f\u0438\u0442\u0430\u043d\u043d\u044f. \u0412\u0456\u0434\u043a\u0440\u0438\u0439\u0442\u0435 \u0437\u0432\u0435\u0440\u043d\u0435\u043d\u043d\u044f \u0432 \u0437\u0430\u0441\u0442\u043e\u0441\u0443\u043d\u043a\u0443.',
      {
        navigateTo: 'SupportRequest',
        supportQuestionId: item.id,
        recipientUserId: item.userId,
        answerPreview: answer.slice(0, 140),
      }
    );
  }
}

async function askSupportQuestion(req, res) {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  const history = Array.isArray(req.body?.history) ? req.body.history : [];

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
      history,
    });
    return res.json(result);
  } catch {
    return res.status(500).json({
      error: 'Не вдалося підготувати відповідь. Спробуйте ще раз трохи пізніше.',
    });
  }
}

async function askPublicSupportQuestion(req, res) {
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
      role: null,
      allowAi: false,
      publicMode: true,
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
  const photos = Array.isArray(req.files)
    ? req.files.map((file) => pathToUploadUrl(file?.path)).filter(Boolean)
    : [];

  if (question.length < 5) {
    await cleanupUploadUrls(photos);
    return res.status(400).json({ error: 'Опишіть питання трохи детальніше.' });
  }

  if (question.length > 1200) {
    await cleanupUploadUrls(photos);
    return res.status(400).json({ error: 'Питання занадто довге. Скоротіть його, будь ласка.' });
  }

  const item = await SupportQuestion.create({
    userId: req.user.id,
    question,
    photos,
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
    photos: item.photos,
    message:
      'Питання передано розробникам. Ви отримаєте відповідь у застосунку найближчим часом.',
  });
}

async function telegramWebhook(req, res) {
  const expectedSecret = String(process.env.SUPPORT_TELEGRAM_WEBHOOK_SECRET || '').trim();
  const receivedSecret = String(req.get('x-telegram-bot-api-secret-token') || req.query?.secret || '').trim();
  if (expectedSecret && receivedSecret !== expectedSecret) {
    return res.status(403).json({ ok: false });
  }

  const message = getTelegramMessage(req.body);
  if (!message?.text) {
    return res.json({ ok: true, skipped: true });
  }

  const { chatId } = getTelegramConfig();
  const messageChatId = String(message.chat?.id || '');
  if (chatId && messageChatId !== String(chatId)) {
    return res.json({ ok: true, skipped: true });
  }

  let answerRequest = parseTelegramAnswerCommand(message.text);
  if (!answerRequest) {
    if (String(message.text).startsWith('/answer') || String(message.text).startsWith('/reply')) {
      await sendTelegramMessage(
        '\u0424\u043e\u0440\u043c\u0430\u0442: /answer ID \u0442\u0435\u043a\u0441\u0442 \u0432\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u0456',
        getTelegramMessageOptions(message)
      );
      return res.json({ ok: true, skipped: true });
    }

    answerRequest = parseTelegramReplyAnswer(message);
    if (!answerRequest) {
      return res.json({ ok: true, skipped: true });
    }
  }

  if (!Number.isFinite(answerRequest.id) || answerRequest.id <= 0) {
    await sendTelegramMessage(
      '\u041d\u0435\u043a\u043e\u0440\u0435\u043a\u0442\u043d\u0438\u0439 ID \u0437\u0432\u0435\u0440\u043d\u0435\u043d\u043d\u044f.',
      getTelegramMessageOptions(message)
    );
    return res.json({ ok: true });
  }

  if (answerRequest.answer.length < 2) {
    await sendTelegramMessage(
      '\u041d\u0430\u043f\u0438\u0448\u0456\u0442\u044c \u0442\u0435\u043a\u0441\u0442 \u0432\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u0456.',
      getTelegramMessageOptions(message)
    );
    return res.json({ ok: true });
  }

  if (answerRequest.answer.length > 3000) {
    await sendTelegramMessage(
      '\u0412\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u044c \u0437\u0430\u043d\u0430\u0434\u0442\u043e \u0434\u043e\u0432\u0433\u0430. \u0421\u043a\u043e\u0440\u043e\u0442\u0456\u0442\u044c \u0457\u0457, \u0431\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430.',
      getTelegramMessageOptions(message)
    );
    return res.json({ ok: true });
  }

  const item = await SupportQuestion.findByPk(answerRequest.id);
  if (!item) {
    await sendTelegramMessage(
      `\u0417\u0432\u0435\u0440\u043d\u0435\u043d\u043d\u044f #${answerRequest.id} \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e.`,
      getTelegramMessageOptions(message)
    );
    return res.json({ ok: true });
  }

  item.answer = answerRequest.answer;
  item.status = SupportQuestionStatus.ANSWERED;
  item.answeredAt = new Date();
  await item.save();

  await notifySupportAnswerUser(item, answerRequest.answer);
  await sendTelegramMessage(
    `\u0412\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u044c \u0434\u043b\u044f \u0437\u0432\u0435\u0440\u043d\u0435\u043d\u043d\u044f #${item.id} \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043d\u043e.`,
    getTelegramMessageOptions(message)
  );

  return res.json({ ok: true, answered: true, id: item.id });
}

module.exports = {
  askSupportQuestion,
  askPublicSupportQuestion,
  listMySupportQuestions,
  createSupportQuestion,
  telegramWebhook,
};
