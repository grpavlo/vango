export const HOST_URL = 'http://192.168.0.170:9999';
//export const HOST_URL = 'https://bagroup.com.ua:1000';
export const API_URL = `${HOST_URL}/api`;

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

function getPhoneFromBody(body) {
  if (!body) return '';
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return typeof parsed?.phone === 'string' ? parsed.phone : '';
    } catch {
      return '';
    }
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return '';
  }
  return typeof body?.phone === 'string' ? body.phone : '';
}

function getCharsetFromContentType(contentType) {
  const match = String(contentType || '').match(/charset\s*=\s*["']?([^;"'\s]+)/i);
  return match?.[1]?.trim()?.toLowerCase() || '';
}

function decodeBytes(bytes, encoding) {
  if (!bytes || typeof TextDecoder === 'undefined') return '';
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return '';
  }
}

function countReplacementChars(text) {
  return (String(text || '').match(/\uFFFD/g) || []).length;
}

function fixUtf8Mojibake(text) {
  const value = String(text || '');
  if (!value || !/[\u00D0\u00D1\u0420\u0421]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from(Array.from(value, (ch) => ch.charCodeAt(0) & 0xff));
    const fixed = decodeBytes(bytes, 'utf-8');
    return fixed || value;
  } catch {
    return value;
  }
}

async function readResponseText(res) {
  if (!res) return '';
  const contentType = res.headers?.get?.('content-type') || '';
  const charset = getCharsetFromContentType(contentType);

  if (typeof res.arrayBuffer === 'function') {
    try {
      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (!bytes.length) return '';

      if (charset) {
        const withCharset = decodeBytes(bytes, charset);
        if (withCharset) return fixUtf8Mojibake(withCharset);
      }

      const utf8 = decodeBytes(bytes, 'utf-8');
      if (utf8 && countReplacementChars(utf8) === 0) {
        return fixUtf8Mojibake(utf8);
      }

      const cp1251 = decodeBytes(bytes, 'windows-1251');
      if (cp1251 && countReplacementChars(cp1251) <= countReplacementChars(utf8)) {
        return fixUtf8Mojibake(cp1251);
      }

      return fixUtf8Mojibake(utf8 || cp1251);
    } catch {
      // Якщо не вдалось, використовуємо резервний варіант через text() нижче.
    }
  }

  try {
    const text = await res.text();
    return fixUtf8Mojibake(text);
  } catch {
    return '';
  }
}

function extractMessageFromParsedError(parsed) {
  if (!parsed) return '';
  if (typeof parsed === 'string') return parsed.trim();
  if (typeof parsed !== 'object') return '';
  const candidates = [parsed.error, parsed.message, parsed.detail, parsed.title];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return '';
}

async function readErrorMessage(res) {
  const contentType = res?.headers?.get?.('content-type') || '';
  const text = (await readResponseText(res)).trim();
  if (!text) return '';

  const shouldTryJson = contentType.includes('application/json') || text.startsWith('{') || text.startsWith('[');
  if (shouldTryJson) {
    try {
      const parsed = JSON.parse(text);
      const extracted = extractMessageFromParsedError(parsed);
      if (extracted) return fixUtf8Mojibake(extracted);
    } catch {}
  }

  return fixUtf8Mojibake(text);
}

// Глобальний обробник для 401 (наприклад, вихід з акаунта + редірект)
let unauthorizedHandler = null;
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const url = `${API_URL}${path}`;
  const method = (options.method || 'GET').toUpperCase();
  const isSendCodeRequest = path === '/auth/send-code' && method === 'POST';
  if (isSendCodeRequest) {
    const phone = getPhoneFromBody(options.body);
    console.info('[mobile.api] send-code request', { phone: maskPhone(phone), method, url });
  }
  let res;
  try {
    res = await fetch(url, {
      headers,
      ...options,
    });
  } catch (error) {
    if (isSendCodeRequest) {
      console.error('[mobile.api] send-code error', {
        status: 0,
        error: error?.message || String(error),
        method,
        url,
      });
    }
    throw error;
  }
  if (isSendCodeRequest) {
    console.info('[mobile.api] send-code response', { status: res.status, ok: res.ok, method, url });
  }
  if (!res.ok) {
    const error = await readErrorMessage(res);
    if (isSendCodeRequest) {
      console.error('[mobile.api] send-code error', { status: res.status, error, method, url });
    }
    if (res.status === 401) {
      try {
        if (typeof unauthorizedHandler === 'function') {
          await unauthorizedHandler();
        }
      } catch {}
      throw new Error(error || 'Не авторизовано');
    }
    throw new Error(error || `Запит завершився помилкою (статус ${res.status})`);
  }
  // Обробка порожніх відповідей (наприклад, 204 No Content)
  if (res.status === 204) {
    if (isSendCodeRequest) {
      console.log('[mobile.api] send-code result', null);
    }
    return null;
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (isSendCodeRequest) {
      console.log('[mobile.api] send-code result', data);
    }
    return data;
  }
  // Резервна обробка для не-JSON відповідей
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    if (isSendCodeRequest) {
      console.log('[mobile.api] send-code result', parsed);
    }
    return parsed;
  } catch {
    const result = text || null;
    if (isSendCodeRequest) {
      console.log('[mobile.api] send-code result', result);
    }
    return result;
  }
}

// ── API для відгуків на замовлення (новий флоу) ──

export function respondToOrder(orderId, token, payload = {}) {
  return apiFetch(`/orders/${orderId}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: Object.keys(payload).length ? JSON.stringify(payload) : undefined,
  });
}

export function markCallMade(orderId, responseId, token) {
  return apiFetch(`/orders/${orderId}/respond/${responseId}/call-made`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function submitCallResult(orderId, responseId, token, result) {
  return apiFetch(`/orders/${orderId}/respond/${responseId}/result`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ result }),
  });
}

export function confirmResponse(orderId, responseId, token) {
  return apiFetch(`/orders/${orderId}/respond/${responseId}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function submitCounterOffer(orderId, responseId, token, finalPrice) {
  return apiFetch(`/orders/${orderId}/respond/${responseId}/counter`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ finalPrice }),
  });
}

export function submitCounterDecision(orderId, responseId, token, decision) {
  return apiFetch(`/orders/${orderId}/respond/${responseId}/counter-decision`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ decision }),
  });
}

export function rejectResponse(orderId, responseId, token) {
  return apiFetch(`/orders/${orderId}/respond/${responseId}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function withdrawResponse(orderId, responseId, token) {
  return apiFetch(`/orders/${orderId}/respond/${responseId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchOrderResponses(orderId, token) {
  return apiFetch(`/orders/${orderId}/responses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchMyResponse(orderId, token) {
  return apiFetch(`/orders/${orderId}/respond/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
