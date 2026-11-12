import AsyncStorage from './personalStorage';

const STORAGE_KEY = 'notification-center:v1';
const MAX_ITEMS = 80;
const DEFAULT_TITLE = '\u0421\u043f\u043e\u0432\u0456\u0449\u0435\u043d\u043d\u044f';
const LEGACY_DEFAULT_TITLE = 'РЎРїРѕРІС–С‰РµРЅРЅСЏ';
const listeners = new Set();
let activeUserId = null;
let storagePaused = false;
let generation = 0;
export function pauseNotificationStorage(value) { if (value && !storagePaused) generation++; storagePaused = value; }
export function canReceivePersonalNotifications() { return !storagePaused && Boolean(activeUserId); }
export function resetNotificationCenter() { generation++; activeUserId = null; notifyListeners([]); }

function normalizeUserId(value) {
  const normalized = value == null ? '' : String(value).trim();
  return normalized || null;
}

function getStorageKey() {
  return activeUserId ? `${STORAGE_KEY}:user:${activeUserId}` : `${STORAGE_KEY}:guest`;
}

async function ensureActiveUser() {
  if (storagePaused) return null;
  if (activeUserId) return activeUserId;
  const expectedGeneration = generation;
  try {
    const saved = await AsyncStorage.getItem('userId');
    if (expectedGeneration === generation && !storagePaused && !activeUserId) activeUserId = normalizeUserId(saved);
  } catch {}
  return activeUserId;
}

function normalizeData(data = {}) {
  const orderId = data?.orderId != null ? String(data.orderId) : null;
  return {
    ...data,
    orderId,
    navigateTo: data?.navigateTo || (orderId ? 'orderDetail' : null),
  };
}

function getTextValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasActionableData(data = {}) {
  const target = data?.navigateTo;
  if (data?.orderId) return true;
  if (target === 'driverOrders' || target === 'driverHistory') return true;
  if (target === 'rateOrder') return Boolean(data?.toUserId);
  if (target === 'ratingDetail') {
    return Boolean(data?.ratingId || data?.rating || data?.comment);
  }
  return false;
}

function isDefaultOnlyNotification(item) {
  const title = getTextValue(item?.title);
  return (
    (title === DEFAULT_TITLE || title === LEGACY_DEFAULT_TITLE) &&
    !getTextValue(item?.body) &&
    !hasActionableData(normalizeData(item?.data || {}))
  );
}

function normalizeNotification(input = {}) {
  const content = input.content || {};
  const data = normalizeData(content.data || input.data || {});
  const title = getTextValue(content.title || input.title);
  const body = getTextValue(content.body || input.body);
  const recipientUserId = normalizeUserId(data?.recipientUserId);

  if (recipientUserId && recipientUserId !== activeUserId) {
    return null;
  }

  if (!title && !body && !hasActionableData(data)) {
    return null;
  }

  const id =
    input.id ||
    input.identifier ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id: String(id),
    title: title || DEFAULT_TITLE,
    body,
    data,
    userId: activeUserId,
    receivedAt: input.receivedAt || new Date().toISOString(),
    read: Boolean(input.read),
  };
}

async function readRawItems() {
  try {
    await ensureActiveUser();
    const raw = await AsyncStorage.getItem(getStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item) => !isDefaultOnlyNotification(item))
      : [];
  } catch {
    return [];
  }
}

async function writeItems(items, expectedGeneration = generation) {
  if (storagePaused || expectedGeneration !== generation) return;
  const filteredItems = (items || []).filter((item) => !isDefaultOnlyNotification(item));
  await AsyncStorage.setItem(getStorageKey(), JSON.stringify(filteredItems.slice(0, MAX_ITEMS)));
  notifyListeners(filteredItems);
}

function notifyListeners(items) {
  if (storagePaused) items = [];
  listeners.forEach((listener) => {
    try {
      listener(items);
    } catch {}
  });
}

export async function getStoredNotifications() {
  return readRawItems();
}

export async function setNotificationCenterUser(userId) {
  if (activeUserId !== normalizeUserId(userId)) generation++;
  activeUserId = normalizeUserId(userId);
  const expectedGeneration = generation;
  const items = await readRawItems();
  if (expectedGeneration === generation) notifyListeners(items);
}

export async function addStoredNotification(input) {
  if (storagePaused) return null;
  await ensureActiveUser();
  if (storagePaused || !activeUserId) {
    return null;
  }

  const expectedGeneration = generation;
  const nextItem = normalizeNotification(input);
  if (!nextItem) {
    console.info('[notificationCenter] skipped empty notification', {
      id: input?.id || input?.identifier || input?.content?.data?.id || null,
      data: input?.content?.data || input?.data || {},
      hasTitle: Boolean(getTextValue(input?.content?.title || input?.title)),
      hasBody: Boolean(getTextValue(input?.content?.body || input?.body)),
    });
    return null;
  }

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

  if (storagePaused || expectedGeneration !== generation) return null;
  await writeItems(nextItems, expectedGeneration);
  return storagePaused || expectedGeneration !== generation ? null : nextItem;
}

export async function markNotificationRead(id) {
  const expectedGeneration = generation;
  if (!id) return;
  const items = await readRawItems();
  const nextItems = items.map((item) =>
    item.id === id ? { ...item, read: true } : item
  );
  await writeItems(nextItems, expectedGeneration);
}

export async function markAllNotificationsRead() {
  const expectedGeneration = generation;
  const items = await readRawItems();
  const nextItems = items.map((item) => ({ ...item, read: true }));
  await writeItems(nextItems, expectedGeneration);
}

export function subscribeNotifications(listener) {
  listeners.add(listener);
  readRawItems().then(listener).catch(() => listener([]));
  return () => listeners.delete(listener);
}

export function getUnreadNotificationCount(items = []) {
  return items.filter((item) => !item.read).length;
}
