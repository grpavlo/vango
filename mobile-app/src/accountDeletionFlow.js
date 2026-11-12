export const DELETION_STORAGE_KEY = 'account-deletion:v1';
export const DELETION_SUCCESS_MESSAGE = 'Акаунт у VanGo видалено. Особисті дані на цьому пристрої очищено. Це підтвердження не охоплює копії у сторонніх сервісах і резервних копіях.';

export function isDeletionLocked(state) {
  return Boolean(state && state.phase !== 'blocked');
}

// Owns the operation across navigation remounts and app restarts.
export function createAccountDeletionFlow({ storage, request, cleanup, onSession, onComplete }) {
  let state = null;
  let running = null;
  const listeners = new Set();
  const publish = next => { state = next; listeners.forEach(listener => listener(next)); };
  const persist = next => storage.setItem(DELETION_STORAGE_KEY, JSON.stringify({token: next.token, phase: next.phase}));

  async function finish() {
    publish({...state, phase: 'local_cleanup', message: ''});
    await persist(state); // server confirmation survives a crash during local cleanup
    await cleanup();
    await storage.removeItem(DELETION_STORAGE_KEY); // last storage operation
    onComplete(DELETION_SUCCESS_MESSAGE);
    onSession(null);
    publish(null);
  }
  async function execute(token, localOnly) {
    try {
      if (localOnly) { await finish(); return; }
      const result = await request(token);
      if (result.status === 'cleanup_pending') {
        publish({token, phase: 'pending', message: 'Доступ до акаунта вже закрито. Видалення файлів ще триває. Натисніть «Перевірити завершення» трохи пізніше.'});
        await persist(state);
        return;
      }
      await finish();
    } catch (error) {
      if (state?.phase === 'local_cleanup') {
        publish({...state, message: 'Сервер підтвердив видалення. Не вдалося очистити всі дані на пристрої. Повторіть очищення.'});
      } else if (error.code === 'ACTIVE_ORDERS') {
        // The server guarantees that this response made no deletion changes.
        try { await storage.removeItem(DELETION_STORAGE_KEY); }
        catch {
          publish({token, phase: 'retry', message: 'Не вдалося оновити стан на пристрої. Повторіть запит.'});
          return;
        }
        onSession(null);
        publish({token, phase: 'blocked', orders: error.orders || [],
          message: 'Не можна видалити акаунт, поки є активні замовлення. Завершіть або скасуйте замовлення зі списку нижче, потім повторіть видалення. Ваш акаунт не видалено.'});
      } else {
        const authRequired = error.status === 401 || error.status === 403;
        publish({token, phase: authRequired ? 'auth_required' : 'retry',
          message: authRequired
            ? `${error.status === 401 ? 'Сеанс завершився. Увійдіть повторно, щоб продовжити.' : 'Доступ до акаунта обмежено. Зверніться до підтримки щодо видалення.'} Завершення видалення не підтверджене. Повторний вхід може створити новий акаунт, якщо попередній уже видалено.`
            : error.status
              ? `${error.message} Завершення видалення не підтверджене.`
              : 'Не отримано підтвердження від сервера: з’єднання перервано або сервер не відповідає. Перевірте інтернет і повторіть запит. Завершення видалення не підтверджене.'});
      }
    }
  }
  function exclusive(operation) {
    if (running) return running;
    running = Promise.resolve().then(operation).finally(() => { running = null; });
    return running;
  }
  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async restore() {
      let raw;
      try { raw = await storage.getItem(DELETION_STORAGE_KEY); }
      catch {
        onSession('unavailable');
        publish({token: null, phase: 'auth_required', message: 'Не вдалося прочитати стан видалення на пристрої. Перезапустіть застосунок і спробуйте ще раз. Завершення видалення не підтверджене.'});
        return;
      }
      if (!raw) return;
      let saved;
      try { saved = JSON.parse(raw); } catch { saved = {}; }
      onSession(saved.token || 'unavailable');
      publish({token: saved.token || null,
        phase: saved.token ? (saved.phase === 'local_cleanup' ? 'local_cleanup' : 'retry') : 'auth_required',
        message: 'Попереднє видалення не було підтверджене на цьому пристрої. Перевірте його завершення.'});
    },
    begin(token) {
      return exclusive(async () => {
        onSession(token);
        publish({token, phase: 'requesting', message: ''});
        try { await persist(state); }
        catch {
          onSession(null);
          publish({token, phase: 'blocked', orders: [], message: 'Не вдалося зберегти стан видалення. Звільніть місце на пристрої та спробуйте ще раз.'});
          return;
        }
        await execute(token, false);
      });
    },
    retry() {
      return exclusive(async () => {
        if (!state?.token) return;
        const localOnly = state.phase === 'local_cleanup';
        if (!localOnly) publish({...state, phase: 'requesting', message: ''});
        await execute(state.token, localOnly);
      });
    },
    exitUnconfirmed() {
      return exclusive(async () => {
        // Clearing this device does not claim that server deletion succeeded.
        await cleanup();
        await storage.removeItem(DELETION_STORAGE_KEY);
        onComplete('Завершення видалення акаунта не підтверджене.');
        onSession(null);
        publish(null);
      });
    },
    dismissBlocked() { if (state?.phase === 'blocked') publish(null); },
  };
}
