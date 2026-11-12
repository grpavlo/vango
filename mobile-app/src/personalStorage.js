import AsyncStorage from '@react-native-async-storage/async-storage';

let paused = false;
let generation = 0;
export function getPersonalStorageGeneration() { return generation; }
const writes = new Set();
function write(method, args) {
  if (paused) return Promise.resolve();
  const pending = Promise.resolve(AsyncStorage[method](...args));
  writes.add(pending);
  pending.then(() => writes.delete(pending), () => writes.delete(pending));
  return pending;
}
export function pausePersonalStorage(value) { if (value && !paused) generation++; paused = value; }
export async function drainPersonalStorage() { await Promise.allSettled([...writes]); }

// Stop old screen callbacks from recreating personal caches after deletion starts.
export default {
  ...AsyncStorage,
  setItem: (...args) => write('setItem', args),
  multiSet: (...args) => write('multiSet', args),
  mergeItem: (...args) => write('mergeItem', args),
  multiMerge: (...args) => write('multiMerge', args),
};
