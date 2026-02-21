const { SMSFLY_API_KEY, SMSFLY_SENDER, SMSFLY_API_URL } = require('../config');

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('380')) return digits;
  if (digits.length === 10 && digits.startsWith('0')) return `38${digits}`;
  if (digits.length === 9) return `380${digits}`;
  return digits;
}

async function sendSms(phone, text) {
  const maskedPhone = maskPhone(phone);

  if (!SMSFLY_API_KEY) {
    console.warn('[SMSFly] SMSFLY_API_KEY is not configured', { phone: maskedPhone });
    return { ok: false, error: 'SMS service is not configured' };
  }

  const recipient = normalizePhone(phone);
  if (!/^380\d{9}$/.test(recipient)) {
    console.warn('[SMSFly] Invalid recipient', { phone: maskedPhone });
    return { ok: false, error: 'Invalid phone number' };
  }

  const payload = {
    auth: { key: SMSFLY_API_KEY },
    action: 'SENDMESSAGE',
    data: {
      recipient,
      channels: ['sms'],
      sms: {
        source: SMSFLY_SENDER,
        ttl: 5,
        text: String(text || ''),
      },
    },
  };

  try {
    const res = await fetch(SMSFLY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let data = null;
    let raw = '';
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      raw = await res.text();
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
    }

    const success = data?.success === 1 || data?.success === true;
    const messageId = data?.data?.sms?.id || null;
    const status = data?.data?.sms?.status || null;

    console.info('[SMSFly] Provider response', {
      recipient: maskPhone(recipient),
      httpStatus: res.status,
      success: data?.success,
      status,
      messageId,
    });

    if (res.ok && success) {
      return { ok: true };
    }

    const providerError = data?.error?.description || data?.error?.code || raw || `HTTP ${res.status}`;
    return { ok: false, error: providerError || 'SMS send failed' };
  } catch (err) {
    console.error('[SMSFly] Request failed', {
      recipient: maskPhone(recipient),
      error: err.message || String(err),
    });
    return { ok: false, error: err.message || 'Network error' };
  }
}

module.exports = { sendSms };
