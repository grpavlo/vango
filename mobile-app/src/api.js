export const HOST_URL = 'http://192.168.0.11:20004';
export const API_URL = `${HOST_URL}/api`;

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
  const res = await fetch(`${API_URL}${path}`, {
    headers,
    ...options,
  });
  if (res.status === 401) {
    const error = await res.text();
    try {
      if (typeof unauthorizedHandler === 'function') {
        unauthorizedHandler();
      }
    } catch {}
    throw new Error(error || 'Unauthorized');
  }
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error);
  }
  // Handle empty responses (e.g. 204 No Content)
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  // Fallback for non-JSON responses
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text || null;
  }
}
