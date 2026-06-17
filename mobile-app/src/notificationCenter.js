import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notification-center:v1';
const MAX_ITEMS = 80;
const listeners = new Set();

function normalizeData(data = {}) {
  const orderId = data?.orderId != null ? String(data.orderId) : null;
  return {
    ...data,
    orderId,
    navigateTo: data?.navigateTo || (orderId ? 'orderDetail' : null),
  };
}

function normalizeNotification(input = {}) {
  const content = input.content || {};
  const data = normalizeData(content.data || input.data || {});
  const id =
    input.id ||
    input.identifier ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id: String(id),
    title: content.title || input.title || 'Сповіщення',
    body: content.body || input.body || '',
    data,
    receivedAt: input.receivedAt || new Date().toISOString(),
    read: Boolean(input.read),
  };
}

async function readRawItems() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeItems(items) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  notifyListeners(items);
}

function notifyListeners(items) {
  listeners.forEach((listener) => {
    try {
      listener(items);
    } catch {}
  });
}

export async function getStoredNotifications() {
  return readRawItems();
}

export async function addStoredNotification(input) {
  const nextItem = normalizeNotification(input);
  const items = await readRawItems();
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);

  let nextItems;
  if (existingIndex >= 0) {
    nextItems = [...items];
    nextItems[existingIndex] = {
      ...nextItems[existingIndex],
      ...nextItem,
      read: nextItems[existingIndex].read || nextItem.read,
    };
  } else {
    nextItems = [nextItem, ...items];
  }

  await writeItems(nextItems);
  return nextItem;
}

export async function markNotificationRead(id) {
  if (!id) return;
  const items = await readRawItems();
  const nextItems = items.map((item) =>
    item.id === id ? { ...item, read: true } : item
  );
  await writeItems(nextItems);
}

export async function markAllNotificationsRead() {
  const items = await readRawItems();
  const nextItems = items.map((item) => ({ ...item, read: true }));
  await writeItems(nextItems);
}

export function subscribeNotifications(listener) {
  listeners.add(listener);
  readRawItems().then(listener).catch(() => listener([]));
  return () => listeners.delete(listener);
}

export function getUnreadNotificationCount(items = []) {
  return items.filter((item) => !item.read).length;
}
