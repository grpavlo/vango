import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "order-updates:v3";
const listeners = new Set();

function emitOrderUpdatesChange() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

export function subscribeOrderUpdates(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function buildStorageKey(role, token) {
  const safeRole = role || "UNKNOWN";
  const tokenSuffix = String(token || "").slice(-16) || "anon";
  return `${STORAGE_PREFIX}:${safeRole}:${tokenSuffix}`;
}

function toMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

function parseHistory(order) {
  if (Array.isArray(order?.history)) return order.history;
  if (typeof order?.history === "string") {
    try {
      const parsed = JSON.parse(order.history);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function hasPhotos(entry) {
  if (!entry) return false;
  if (Array.isArray(entry.photos) && entry.photos.some(Boolean)) return true;
  return Boolean(entry.photo);
}

function normalizeRole(value) {
  const role = String(value || "").trim().toUpperCase();
  if (role === "DRIVER" || role === "CUSTOMER") return role;
  return null;
}

function getActorRoleFromIds(entry, order) {
  const actorId = String(entry?.changedById || entry?.uploadedBy || "");
  if (!actorId) return null;

  if (String(order?.driverId || "") === actorId) return "DRIVER";
  if (String(order?.customerId || "") === actorId) return "CUSTOMER";
  return null;
}

function inferActorRoleByStatus(entry) {
  const status = String(entry?.status || "").toUpperCase();
  if (status === "ACCEPTED") {
    return "CUSTOMER";
  }
  if (status === "PENDING" || status === "IN_PROGRESS" || status === "DELIVERED") {
    return "DRIVER";
  }
  if (status === "COMPLETED" || status === "REJECTED") {
    return "CUSTOMER";
  }
  return null;
}

function getEntryActorRole(entry, order) {
  const explicitRole = normalizeRole(entry?.changedByRole);
  if (explicitRole) return explicitRole;

  const byIds = getActorRoleFromIds(entry, order);
  if (byIds) return byIds;

  return inferActorRoleByStatus(entry);
}

function isEntryRelevantForViewer(entry, order, viewerRole) {
  const normalizedViewerRole = normalizeRole(viewerRole);
  if (!normalizedViewerRole) return false;

  const actorRole = getEntryActorRole(entry, order);
  if (!actorRole) return false;

  if (normalizedViewerRole === "CUSTOMER") return actorRole === "DRIVER";
  if (normalizedViewerRole === "DRIVER") return actorRole === "CUSTOMER";
  return false;
}

export function buildOrderUpdateSnapshot(order, viewerRole) {
  const history = parseHistory(order);
  let latestStatusMs = 0;
  let latestPhotoMs = 0;

  history.forEach((entry) => {
    const atMs = toMs(entry?.at);
    if (!atMs) return;
    if (!isEntryRelevantForViewer(entry, order, viewerRole)) return;

    if (entry?.status && entry.status !== "PRICE_UPDATED") {
      if (atMs > latestStatusMs) latestStatusMs = atMs;
    }

    if (hasPhotos(entry) && atMs > latestPhotoMs) {
      latestPhotoMs = atMs;
    }
  });

  return { statusMs: latestStatusMs, photoMs: latestPhotoMs };
}

async function readState(role, token) {
  const key = buildStorageKey(role, token);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return { key, state: { orders: {} } };
  try {
    const parsed = JSON.parse(raw);
    return {
      key,
      state:
        parsed && typeof parsed === "object" && parsed.orders
          ? parsed
          : { orders: {} },
    };
  } catch {
    return { key, state: { orders: {} } };
  }
}

async function writeState(key, state) {
  await AsyncStorage.setItem(key, JSON.stringify(state));
}

function buildUnreadByOrder(ordersState) {
  const unreadByOrder = {};
  let hasUnreadAny = false;

  Object.entries(ordersState || {}).forEach(([orderId, item]) => {
    const latestStatusMs = Number(item?.latestStatusMs) || 0;
    const latestPhotoMs = Number(item?.latestPhotoMs) || 0;
    const seenStatusMs = Number(item?.seenStatusMs) || 0;
    const seenPhotoMs = Number(item?.seenPhotoMs) || 0;

    const status = latestStatusMs > seenStatusMs;
    const photo = latestPhotoMs > seenPhotoMs;

    unreadByOrder[orderId] = { status, photo };
    if (status || photo) hasUnreadAny = true;
  });

  return { unreadByOrder, hasUnreadAny };
}

export async function reconcileOrderUpdates(role, token, orders) {
  if (!role || !token) return { unreadByOrder: {}, hasUnreadAny: false };

  const list = Array.isArray(orders) ? orders : [];
  const { key, state } = await readState(role, token);
  const nextOrdersState = { ...(state.orders || {}) };
  let changed = false;
  const currentOrderIds = new Set();

  list.forEach((order) => {
    const orderId = String(order?.id || "");
    if (!orderId) return;
    currentOrderIds.add(orderId);

    const snapshot = buildOrderUpdateSnapshot(order, role);
    const existing = nextOrdersState[orderId];

    if (!existing) {
      nextOrdersState[orderId] = {
        seenStatusMs: snapshot.statusMs,
        seenPhotoMs: snapshot.photoMs,
        latestStatusMs: snapshot.statusMs,
        latestPhotoMs: snapshot.photoMs,
      };
      changed = true;
      return;
    }

    const prevStatus = Number(existing.latestStatusMs) || 0;
    const prevPhoto = Number(existing.latestPhotoMs) || 0;
    if (prevStatus !== snapshot.statusMs || prevPhoto !== snapshot.photoMs) {
      nextOrdersState[orderId] = {
        ...existing,
        latestStatusMs: snapshot.statusMs,
        latestPhotoMs: snapshot.photoMs,
      };
      changed = true;
    }
  });

  Object.keys(nextOrdersState).forEach((orderId) => {
    if (currentOrderIds.has(orderId)) return;
    delete nextOrdersState[orderId];
    changed = true;
  });

  const scopedState = {};
  list.forEach((order) => {
    const orderId = String(order?.id || "");
    if (!orderId || !nextOrdersState[orderId]) return;
    scopedState[orderId] = nextOrdersState[orderId];
  });

  const result = buildUnreadByOrder(scopedState);

  if (changed) {
    await writeState(key, { orders: nextOrdersState });
    emitOrderUpdatesChange();
  }

  return result;
}

export async function markOrderUpdatesSeen(role, token, order) {
  if (!role || !token || !order?.id) return;

  const { key, state } = await readState(role, token);
  const orderId = String(order.id);
  const current = (state.orders || {})[orderId] || {};
  const snapshot = buildOrderUpdateSnapshot(order, role);

  const latestStatusMs = Math.max(
    Number(current.latestStatusMs) || 0,
    snapshot.statusMs
  );
  const latestPhotoMs = Math.max(
    Number(current.latestPhotoMs) || 0,
    snapshot.photoMs
  );

  const nextRecord = {
    ...current,
    latestStatusMs,
    latestPhotoMs,
    seenStatusMs: latestStatusMs,
    seenPhotoMs: latestPhotoMs,
  };

  const same =
    Number(current.seenStatusMs) === nextRecord.seenStatusMs &&
    Number(current.seenPhotoMs) === nextRecord.seenPhotoMs &&
    Number(current.latestStatusMs) === nextRecord.latestStatusMs &&
    Number(current.latestPhotoMs) === nextRecord.latestPhotoMs;

  if (same) return;

  const nextState = {
    orders: {
      ...(state.orders || {}),
      [orderId]: nextRecord,
    },
  };

  await writeState(key, nextState);
  emitOrderUpdatesChange();
}

export async function getHasUnreadOrderUpdates(role, token) {
  if (!role || !token) return false;
  const { state } = await readState(role, token);
  return buildUnreadByOrder(state.orders || {}).hasUnreadAny;
}
