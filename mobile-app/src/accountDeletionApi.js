import { API_URL } from './api';

export async function requestAccountDeletion(token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'DELETE', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({confirm: true}), signal: controller.signal,
    });
    // Proxies and older API versions can return text/HTML errors.
    // Keep the HTTP status so expired sessions still offer recovery.
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!data || typeof data !== 'object') data = {};
    if (!response.ok) {
      const reasons = {
        ACTIVE_ORDERS: 'Не можна видалити акаунт, поки є активні замовлення. Завершіть або скасуйте замовлення зі списку нижче, потім повторіть видалення. Ваш акаунт не видалено.',
        ACCOUNT_BLOCKED: 'Доступ до акаунта заблоковано. Зверніться до підтримки, щоб вирішити питання видалення.',
        INVALID_CONFIRMATION: 'Сервер не отримав підтвердження видалення. Оновіть застосунок і повторіть спробу.',
      };
      const message = reasons[data.code] || (response.status === 404 || response.status === 405
        ? 'Сервер не підтримує видалення акаунта. Потрібне оновлення API.'
        : response.status === 503
          ? 'Видалення тимчасово недоступне на сервері. Повторіть пізніше.'
          : response.status === 429
            ? 'Забагато спроб видалення. Зачекайте кілька хвилин і повторіть запит.'
            : 'Сервер не зміг обробити запит на видалення. Повторіть пізніше.');
      throw Object.assign(new Error(message), {
        status: response.status, code: data.code, orders: data.orders,
      });
    }
    if (data.scope !== 'application_data' ||
        !((response.status === 200 && data.status === 'deleted') ||
          (response.status === 202 && data.status === 'cleanup_pending'))) {
      throw new Error('Сервер не підтвердив завершення видалення.');
    }
    return data;
  } finally { clearTimeout(timer); }
}
