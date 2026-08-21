const fs = require('fs/promises');
const path = require('path');
const { uploadUrlToAbsolutePath } = require('../utils/uploadFiles');

function truncate(value, maxLength = 1800) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

function formatUser(user) {
  const parts = [
    user?.name,
    user?.firstName || user?.lastName ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() : '',
    user?.phone,
    user?.email,
  ].filter(Boolean);
  return parts.length ? parts.join(' | ') : `ID ${user?.id || '-'}`;
}

function getTelegramConfig() {
  return {
    token: process.env.SUPPORT_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.SUPPORT_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID,
  };
}

function getQuestionPhotos(question) {
  return Array.isArray(question?.photos) ? question.photos.filter(Boolean) : [];
}

async function sendTelegramMessage(text, options = {}) {
  const { token, chatId: defaultChatId } = getTelegramConfig();
  const chatId = options.chatId || defaultChatId;
  if (!token || !chatId || typeof fetch !== 'function') {
    return { ok: false, skipped: true };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(options.replyToMessageId ? { reply_to_message_id: options.replyToMessageId } : {}),
        ...(options.messageThreadId ? { message_thread_id: options.messageThreadId } : {}),
        ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
      }),
    });
    return { ok: response.ok, skipped: false };
  } catch {
    return { ok: false, skipped: false };
  }
}

async function sendTelegramPhoto(photoPath, options = {}) {
  const { token, chatId: defaultChatId } = getTelegramConfig();
  const chatId = options.chatId || defaultChatId;
  if (!token || !chatId || typeof fetch !== 'function' || typeof FormData === 'undefined' || typeof Blob === 'undefined') {
    return { ok: false, skipped: true };
  }

  const absPath = uploadUrlToAbsolutePath(photoPath);
  if (!absPath) {
    return { ok: false, skipped: true };
  }

  try {
    const buffer = await fs.readFile(absPath);
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('photo', new Blob([buffer]), path.basename(absPath));
    if (options.caption) formData.append('caption', String(options.caption));
    if (options.messageThreadId) formData.append('message_thread_id', String(options.messageThreadId));

    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });
    return { ok: response.ok, skipped: false };
  } catch {
    return { ok: false, skipped: false };
  }
}

async function notifySupportQuestionCreated(question) {
  const photos = getQuestionPhotos(question);
  const photoLines = photos.length
    ? [
        '',
        `\u0424\u043e\u0442\u043e: ${photos.length} \u043d\u0430\u0434\u0456\u0441\u043b\u0430\u043d\u043e \u043e\u043a\u0440\u0435\u043c\u043e \u043d\u0438\u0436\u0447\u0435.`,
      ]
    : [];
  const text = [
    '\u041d\u043e\u0432\u0435 \u043f\u0438\u0442\u0430\u043d\u043d\u044f \u0434\u043e \u0440\u043e\u0437\u0440\u043e\u0431\u043d\u0438\u043a\u0456\u0432 VanGo',
    `ID: ${question.id}`,
    `\u041a\u043e\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447: ${formatUser(question.user)}`,
    `\u0420\u043e\u043b\u044c: ${question.user?.role || '-'}`,
    '',
    truncate(question.question),
    ...photoLines,
    '',
    '\u041d\u0430\u0442\u0438\u0441\u043d\u0456\u0442\u044c "\u0412\u0456\u0434\u043f\u043e\u0432\u0456\u0441\u0442\u0438" \u043d\u0430 \u0446\u0435 \u043f\u043e\u0432\u0456\u0434\u043e\u043c\u043b\u0435\u043d\u043d\u044f \u0456 \u043d\u0430\u043f\u0438\u0448\u0456\u0442\u044c \u0442\u0435\u043a\u0441\u0442 \u0432\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u0456.',
    `\u0410\u0431\u043e: /answer ${question.id} \u0442\u0435\u043a\u0441\u0442 \u0432\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u0456`,
  ].join('\n');

  const messageResult = await sendTelegramMessage(text, {
    replyMarkup: {
      force_reply: true,
      selective: false,
      input_field_placeholder: '\u041d\u0430\u043f\u0438\u0448\u0456\u0442\u044c \u0432\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u044c \u043a\u043e\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0443',
    },
  });

  for (const [index, photo] of photos.entries()) {
    await sendTelegramPhoto(photo, {
      caption: `\u0424\u043e\u0442\u043e \u0434\u043e \u0437\u0432\u0435\u0440\u043d\u0435\u043d\u043d\u044f #${question.id} (${index + 1}/${photos.length})`,
    });
  }

  return messageResult;
}

module.exports = {
  getTelegramConfig,
  sendTelegramMessage,
  sendTelegramPhoto,
  notifySupportQuestionCreated,
};
