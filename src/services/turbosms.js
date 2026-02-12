const { TURBOSMS_TOKEN, TURBOSMS_SENDER } = require('../config');

const API_URL = 'https://api.turbosms.ua/message/send.json';

async function sendSms(phone, text) {
  if (!TURBOSMS_TOKEN) {
    console.warn('[TurboSMS] TURBOSMS_TOKEN не налаштовано');
    return { ok: false, error: 'SMS не налаштовано' };
  }
  const normalized = phone.replace(/\D/g, '');
  const recipient = normalized.startsWith('0') ? '38' + normalized : (normalized.startsWith('38') ? normalized : '38' + normalized);
  if (recipient.length < 12) {
    return { ok: false, error: 'Некоректний номер телефону' };
  }
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TURBOSMS_TOKEN}`,
      },
      body: JSON.stringify({
        recipients: [recipient],
        sms: {
          sender: TURBOSMS_SENDER,
          text,
        },
      }),
    });
    const data = await res.json();
    if (data.response_code === 0 || data.response_code === 800 || data.response_code === 801) {
      return { ok: true };
    }
    return { ok: false, error: data.response_status || 'Помилка відправки SMS' };
  } catch (err) {
    console.error('[TurboSMS]', err);
    return { ok: false, error: err.message || 'Помилка мережі' };
  }
}

module.exports = { sendSms };
