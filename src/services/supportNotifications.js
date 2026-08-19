function truncate(value, maxLength = 1800) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
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

async function notifySupportQuestionCreated(question) {
  const token = process.env.SUPPORT_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.SUPPORT_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId || typeof fetch !== 'function') {
    return { ok: false, skipped: true };
  }

  const text = [
    'Нове питання до розробників VanGo',
    `ID: ${question.id}`,
    `Користувач: ${formatUser(question.user)}`,
    `Роль: ${question.user?.role || '-'}`,
    '',
    truncate(question.question),
  ].join('\n');

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    return { ok: response.ok, skipped: false };
  } catch {
    return { ok: false, skipped: false };
  }
}

module.exports = {
  notifySupportQuestionCreated,
};
