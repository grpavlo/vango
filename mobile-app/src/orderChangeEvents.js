const listeners = new Set();

export function emitOrderChange(event = {}) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {}
  });
}

export function subscribeOrderChanges(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
