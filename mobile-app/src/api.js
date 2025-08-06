export const HOST_URL = 'http://192.168.95.22:20004';
export const API_URL = `${HOST_URL}/api`;

let unauthorizedHandler;

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
  const text = await res.text();
  if (res.status === 401 && unauthorizedHandler) {
    unauthorizedHandler(text);
  }
  if (!res.ok) {
    throw new Error(text);
  }
  return text ? JSON.parse(text) : {};
}
