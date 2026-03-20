const DAY_IN_MS = 24 * 60 * 60 * 1000;

const STALE_KEEP_DAYS = 14;
const LOW_PRIORITY_FROM_STALE_DAY = 4;

const REMINDER_PLAN = [
  { key: "D0", dayOffset: 0 },
  { key: "D2", dayOffset: 2 },
  { key: "D4", dayOffset: 4 },
  { key: "D6", dayOffset: 6 },
  { key: "D9", dayOffset: 9 },
  { key: "D11", dayOffset: 11 },
  { key: "D13", dayOffset: 13 },
];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function validDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getOrderReferenceDate(order) {
  if (!order) return null;
  if (order.freeDate) {
    return validDate(order.freeDateUntil || order.unloadTo || order.loadTo || order.loadFrom);
  }
  return validDate(order.unloadTo || order.loadTo || order.loadFrom);
}

function getOrderLifecycle(order, now = new Date()) {
  const refDate = getOrderReferenceDate(order);
  if (!refDate) {
    return {
      hasReferenceDate: false,
      isStale: false,
      staleDays: 0,
      isLowPriority: false,
      staleSince: null,
      autoCloseAt: null,
      isAutoCloseDue: false,
      lastActiveDay: null,
    };
  }

  const lastActiveDay = endOfDay(refDate);
  const staleSince = addDays(startOfDay(refDate), 1);
  const autoCloseAt = addDays(staleSince, STALE_KEEP_DAYS);

  if (now < staleSince) {
    return {
      hasReferenceDate: true,
      isStale: false,
      staleDays: 0,
      isLowPriority: false,
      staleSince,
      autoCloseAt,
      isAutoCloseDue: false,
      lastActiveDay,
    };
  }

  const staleDays =
    Math.floor((startOfDay(now).getTime() - startOfDay(staleSince).getTime()) / DAY_IN_MS) + 1;

  return {
    hasReferenceDate: true,
    isStale: true,
    staleDays,
    isLowPriority: staleDays >= LOW_PRIORITY_FROM_STALE_DAY,
    staleSince,
    autoCloseAt,
    isAutoCloseDue: now >= autoCloseAt,
    lastActiveDay,
  };
}

function getLifecycleCutoffDate(now = new Date()) {
  return addDays(startOfDay(now), -STALE_KEEP_DAYS);
}

function dueAtFromReference(referenceDate, dayOffset) {
  const dueAt = new Date(referenceDate);
  dueAt.setHours(17, 0, 0, 0);
  dueAt.setDate(dueAt.getDate() + dayOffset);
  return dueAt;
}

module.exports = {
  DAY_IN_MS,
  STALE_KEEP_DAYS,
  LOW_PRIORITY_FROM_STALE_DAY,
  REMINDER_PLAN,
  startOfDay,
  endOfDay,
  addDays,
  validDate,
  getOrderReferenceDate,
  getOrderLifecycle,
  getLifecycleCutoffDate,
  dueAtFromReference,
};
