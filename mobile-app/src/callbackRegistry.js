const registry = new Map();
let seq = 1;

export function registerCallback(cb) {
  if (typeof cb !== 'function') return null;
  const id = String(seq++);
  registry.set(id, cb);
  return id;
}

export function getCallback(id) {
  if (!id) return null;
  return registry.get(String(id)) || null;
}

export function unregisterCallback(id) {
  if (!id) return;
  registry.delete(String(id));
}

