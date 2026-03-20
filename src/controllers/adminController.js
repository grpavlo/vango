const { Op } = require("sequelize");
const User = require("../models/user");
const Order = require("../models/order");
const OrderResponse = require("../models/orderResponse");
const OrderRouteSearchEvent = require("../models/orderRouteSearchEvent");
const { setServiceFee } = require("../config");

const DAY_MS = 24 * 60 * 60 * 1000;
const MATCHED_ORDER_STATUSES = ["ACCEPTED", "IN_PROGRESS", "DELIVERED", "COMPLETED"];

function parseWindowDays(raw, fallback = 30) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function rangeFromDays(days, now = new Date()) {
  const end = new Date(now);
  const start = new Date(startOfDay(now).getTime() - (days - 1) * DAY_MS);
  return { start, end };
}

function formatDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toMoneyValue(orderLike) {
  const finalPrice = Number(orderLike?.finalPrice);
  if (Number.isFinite(finalPrice)) return finalPrice;
  const price = Number(orderLike?.price);
  return Number.isFinite(price) ? price : 0;
}

function isMatchedOrder(orderLike) {
  if (orderLike?.driverId) return true;
  return MATCHED_ORDER_STATUSES.includes(orderLike?.status);
}

function parseHistory(historyRaw) {
  if (!historyRaw) return [];
  if (Array.isArray(historyRaw)) return historyRaw;
  if (typeof historyRaw === "string") {
    try {
      const parsed = JSON.parse(historyRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function extractAcceptedAt(orderLike) {
  const history = parseHistory(orderLike?.history);
  const acceptedEntry = history.find((h) => h?.status === "ACCEPTED" && h?.at);
  if (acceptedEntry) {
    const at = new Date(acceptedEntry.at);
    if (!Number.isNaN(at.getTime())) return at;
  }
  const fallback = new Date(orderLike?.updatedAt);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

async function getGmvMetrics(now = new Date(), windowDays = 30) {
  const { start, end } = rangeFromDays(windowDays, now);
  const orders = await Order.findAll({
    attributes: ["id", "price", "finalPrice", "status", "driverId", "createdAt"],
    where: {
      [Op.or]: [
        { status: { [Op.in]: MATCHED_ORDER_STATUSES } },
        { driverId: { [Op.ne]: null } },
      ],
    },
    raw: true,
  });

  let allTime = 0;
  let period = 0;
  for (const order of orders) {
    const value = toMoneyValue(order);
    allTime += value;
    const createdAt = new Date(order.createdAt);
    if (createdAt >= start && createdAt <= end) {
      period += value;
    }
  }

  return {
    allTime: Number(allTime.toFixed(2)),
    period: {
      days: windowDays,
      from: start,
      to: end,
      value: Number(period.toFixed(2)),
    },
  };
}

async function collectActiveUserIds(range) {
  const { start, end } = range;
  const ids = new Set();

  const orders = await Order.findAll({
    attributes: ["customerId", "driverId", "reservedBy", "candidateDriverId", "createdAt", "updatedAt"],
    where: {
      [Op.or]: [
        { createdAt: { [Op.between]: [start, end] } },
        { updatedAt: { [Op.between]: [start, end] } },
      ],
    },
    raw: true,
  });
  for (const row of orders) {
    [row.customerId, row.driverId, row.reservedBy, row.candidateDriverId].forEach((id) => {
      if (id) ids.add(Number(id));
    });
  }

  const responses = await OrderResponse.findAll({
    attributes: ["driverId", "respondedAt", "callMadeAt", "resultSubmittedAt", "confirmedAt"],
    where: {
      [Op.or]: [
        { respondedAt: { [Op.between]: [start, end] } },
        { callMadeAt: { [Op.between]: [start, end] } },
        { resultSubmittedAt: { [Op.between]: [start, end] } },
        { confirmedAt: { [Op.between]: [start, end] } },
      ],
    },
    raw: true,
  });
  for (const row of responses) {
    if (row.driverId) ids.add(Number(row.driverId));
  }

  const fromDayKey = formatDayKey(start);
  const toDayKey = formatDayKey(end);
  const routeSearches = await OrderRouteSearchEvent.findAll({
    attributes: ["driverId"],
    where: { dayKey: { [Op.between]: [fromDayKey, toDayKey] } },
    raw: true,
  });
  for (const row of routeSearches) {
    if (row.driverId) ids.add(Number(row.driverId));
  }

  return ids;
}

async function getActiveUsersMetrics(now = new Date()) {
  const dauRange = rangeFromDays(1, now);
  const wauRange = rangeFromDays(7, now);
  const mauRange = rangeFromDays(30, now);

  const [dauSet, wauSet, mauSet] = await Promise.all([
    collectActiveUserIds(dauRange),
    collectActiveUserIds(wauRange),
    collectActiveUserIds(mauRange),
  ]);

  const dau = dauSet.size;
  const wau = wauSet.size;
  const mau = mauSet.size;
  const dauToMau = mau > 0 ? dau / mau : 0;

  return {
    dau,
    wau,
    mau,
    dauToMauRatio: Number(dauToMau.toFixed(4)),
    dauToMauPercent: Number((dauToMau * 100).toFixed(2)),
    calculatedAt: now,
  };
}

async function getLiquidityMetrics(now = new Date(), windowDays = 30) {
  const { start, end } = rangeFromDays(windowDays, now);
  const periodOrders = await Order.findAll({
    attributes: ["id", "driverId", "status", "createdAt", "updatedAt", "history"],
    where: { createdAt: { [Op.between]: [start, end] } },
    raw: true,
  });

  const totalOrders = periodOrders.length;
  const matchedOrders = periodOrders.filter(isMatchedOrder);
  const matchedCount = matchedOrders.length;
  const foundDriverPercent = totalOrders > 0 ? (matchedCount / totalOrders) * 100 : 0;

  let totalCloseMs = 0;
  let closeSamples = 0;
  for (const order of matchedOrders) {
    const createdAt = new Date(order.createdAt);
    const acceptedAt = extractAcceptedAt(order);
    if (!acceptedAt) continue;
    const diff = acceptedAt.getTime() - createdAt.getTime();
    if (diff < 0) continue;
    totalCloseMs += diff;
    closeSamples += 1;
  }
  const avgCloseHours = closeSamples > 0 ? totalCloseMs / closeSamples / (60 * 60 * 1000) : 0;

  const orderIds = periodOrders.map((o) => o.id);
  let totalResponses = 0;
  if (orderIds.length > 0) {
    totalResponses = await OrderResponse.count({
      where: { orderId: { [Op.in]: orderIds } },
    });
  }
  const responsesPerOrder = totalOrders > 0 ? totalResponses / totalOrders : 0;

  return {
    period: { days: windowDays, from: start, to: end },
    totalOrders,
    matchedOrders: matchedCount,
    foundDriverPercent: Number(foundDriverPercent.toFixed(2)),
    avgTimeToCloseHours: Number(avgCloseHours.toFixed(2)),
    responsesPerOrder: Number(responsesPerOrder.toFixed(2)),
    totalResponses,
  };
}

async function buildDriverActivityMap() {
  const map = new Map();
  const add = (driverId, at) => {
    if (!driverId || !at) return;
    const dt = new Date(at);
    if (Number.isNaN(dt.getTime())) return;
    if (!map.has(driverId)) map.set(driverId, []);
    map.get(driverId).push(dt);
  };

  const responses = await OrderResponse.findAll({
    attributes: ["driverId", "respondedAt", "callMadeAt", "resultSubmittedAt", "confirmedAt"],
    raw: true,
  });
  for (const row of responses) {
    add(row.driverId, row.respondedAt);
    add(row.driverId, row.callMadeAt);
    add(row.driverId, row.resultSubmittedAt);
    add(row.driverId, row.confirmedAt);
  }

  const routeSearches = await OrderRouteSearchEvent.findAll({
    attributes: ["driverId", "dayKey"],
    raw: true,
  });
  for (const row of routeSearches) {
    add(row.driverId, `${row.dayKey}T12:00:00.000Z`);
  }

  const assignedOrders = await Order.findAll({
    attributes: ["driverId", "reservedBy", "candidateDriverId", "updatedAt"],
    raw: true,
  });
  for (const row of assignedOrders) {
    add(row.driverId, row.updatedAt);
    add(row.reservedBy, row.updatedAt);
    add(row.candidateDriverId, row.updatedAt);
  }

  return map;
}

function calcRetentionForDays(drivers, activityMap, days, now = new Date()) {
  const windowMs = days * DAY_MS;
  let eligible = 0;
  let returned = 0;

  for (const driver of drivers) {
    const createdAt = new Date(driver.createdAt);
    if (Number.isNaN(createdAt.getTime())) continue;
    if (createdAt.getTime() + windowMs > now.getTime()) continue;
    eligible += 1;

    const activities = activityMap.get(driver.id) || [];
    const hasReturn = activities.some(
      (at) => at.getTime() > createdAt.getTime() && at.getTime() <= createdAt.getTime() + windowMs
    );
    if (hasReturn) returned += 1;
  }

  return {
    days,
    eligibleDrivers: eligible,
    returnedDrivers: returned,
    rate: eligible > 0 ? Number((returned / eligible).toFixed(4)) : 0,
    percent: eligible > 0 ? Number(((returned / eligible) * 100).toFixed(2)) : 0,
  };
}

async function getDriverRetentionMetrics(now = new Date()) {
  const drivers = await User.findAll({
    attributes: ["id", "createdAt", "role"],
    where: { role: { [Op.in]: ["DRIVER", "BOTH"] } },
    raw: true,
  });
  const activityMap = await buildDriverActivityMap();

  return {
    calculatedAt: now,
    driversTotal: drivers.length,
    retention7d: calcRetentionForDays(drivers, activityMap, 7, now),
    retention30d: calcRetentionForDays(drivers, activityMap, 30, now),
    retention90d: calcRetentionForDays(drivers, activityMap, 90, now),
  };
}

async function buildOverviewMetrics(req) {
  const now = new Date();
  const windowDays = parseWindowDays(req.query?.days, 30);
  const [gmv, activeUsers, liquidity, retention] = await Promise.all([
    getGmvMetrics(now, windowDays),
    getActiveUsersMetrics(now),
    getLiquidityMetrics(now, windowDays),
    getDriverRetentionMetrics(now),
  ]);
  return {
    generatedAt: now,
    periodDays: windowDays,
    gmv,
    activeUsers,
    liquidity,
    retention,
  };
}

async function listUsers(_req, res) {
  const users = await User.findAll();
  res.json(users);
}

async function blockDriver(req, res) {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user || (user.role !== "DRIVER" && user.role !== "BOTH")) {
    res.status(404).send("Водія не знайдено");
    return;
  }
  user.blocked = true;
  await user.save();
  res.json(user);
}

async function unblockDriver(req, res) {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user || (user.role !== "DRIVER" && user.role !== "BOTH")) {
    res.status(404).send("Водія не знайдено");
    return;
  }
  user.blocked = false;
  await user.save();
  res.json(user);
}

async function updateServiceFee(req, res) {
  const { percent } = req.body;
  setServiceFee(percent);
  res.json({ percent });
}

async function analytics(req, res) {
  try {
    const payload = await buildOverviewMetrics(req);
    res.json(payload);
  } catch (err) {
    console.error("analytics overview error", err);
    res.status(500).send("Не вдалося зібрати аналітику");
  }
}

async function analyticsOverview(req, res) {
  return analytics(req, res);
}

async function analyticsGmv(req, res) {
  try {
    const days = parseWindowDays(req.query?.days, 30);
    const data = await getGmvMetrics(new Date(), days);
    res.json(data);
  } catch (err) {
    console.error("analytics gmv error", err);
    res.status(500).send("Не вдалося порахувати GMV");
  }
}

async function analyticsActiveUsers(_req, res) {
  try {
    const data = await getActiveUsersMetrics(new Date());
    res.json(data);
  } catch (err) {
    console.error("analytics active users error", err);
    res.status(500).send("Не вдалося порахувати активних користувачів");
  }
}

async function analyticsLiquidity(req, res) {
  try {
    const days = parseWindowDays(req.query?.days, 30);
    const data = await getLiquidityMetrics(new Date(), days);
    res.json(data);
  } catch (err) {
    console.error("analytics liquidity error", err);
    res.status(500).send("Не вдалося порахувати ліквідність");
  }
}

async function analyticsRetention(_req, res) {
  try {
    const data = await getDriverRetentionMetrics(new Date());
    res.json(data);
  } catch (err) {
    console.error("analytics retention error", err);
    res.status(500).send("Не вдалося порахувати retention");
  }
}

module.exports = {
  listUsers,
  blockDriver,
  unblockDriver,
  updateServiceFee,
  analytics,
  analyticsOverview,
  analyticsGmv,
  analyticsActiveUsers,
  analyticsLiquidity,
  analyticsRetention,
};
