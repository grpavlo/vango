export const HOST_URL = 'https://bagroup.com.ua:1000';
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

// Optional global handler to react on 401 Unauthorized (e.g., logout + redirect)
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
  if (res.status === 401) {
    const error = await res.text();
    if (isSendCodeRequest) {
      console.error('[mobile.api] send-code error', { status: res.status, error, method, url });
    }
    try {
      if (typeof unauthorizedHandler === 'function') {
        await unauthorizedHandler();
      }
    } catch {}
    throw new Error(error || 'Unauthorized');
  }
  if (!res.ok) {
    const error = await res.text();
    if (isSendCodeRequest) {
      console.error('[mobile.api] send-code error', { status: res.status, error, method, url });
    }
    throw new Error(error);
  }
  // Handle empty responses (e.g. 204 No Content)
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
  // Fallback for non-JSON responses
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

// ── OrderResponse API (new response flow) ──

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
