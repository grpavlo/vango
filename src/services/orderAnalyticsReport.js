const { Op } = require('sequelize');
const User = require('../models/user');
const { UserRole } = User;
const Group = require('../models/group');
const Order = require('../models/order');
const Rating = require('../models/rating');
const { parseDispatcherQuery } = require('../utils/dispatcherAccess');
const DAY_MS = 86400000;

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

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseDateParam(value) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveAnalyticsRange(query = {}, now = new Date()) {
  const days = parseWindowDays(query.days, 30);
  const fallback = rangeFromDays(days, now);
  const start = parseDateParam(query.dateFrom);
  const end = parseDateParam(query.dateTo);

  return {
    start: start ? startOfDay(start) : fallback.start,
    end: end ? endOfDay(end) : fallback.end,
    days,
  };
}

function toMoneyValue(orderLike) {
  const finalPrice = Number(orderLike?.finalPrice);
  if (orderLike?.finalPrice !== null && orderLike?.finalPrice !== undefined && Number.isFinite(finalPrice)) return finalPrice;
  const price = Number(orderLike?.price);
  return Number.isFinite(price) ? price : 0;
}

function normalizePhotoList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return normalizePhotoList(parsed);
    } catch {
      return [trimmed];
    }
  }
  return [];
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

function getFirstStatusDate(orderLike, status) {
  const history = parseHistory(orderLike?.history);
  for (const entry of history) {
    if (entry?.status !== status || !entry.at) continue;
    const date = new Date(entry.at);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function getLastStatusDate(orderLike, status) {
  const history = parseHistory(orderLike?.history);
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry?.status !== status || !entry.at) continue;
    const date = new Date(entry.at);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function minutesBetween(start, end) {
  if (!start || !end) return null;
  const diff = end.getTime() - start.getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round(diff / 60000);
}

function roundMetric(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(digits));
}

function serializeReportUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    rating: user.rating,
    blocked: user.blocked,
    groupId: user.groupId,
    group: user.group ? { id: user.group.id, name: user.group.name } : null,
  };
}

function getReportDriver(orderLike) {
  return orderLike?.driver || orderLike?.candidateDriver || orderLike?.reservedDriver || null;
}
async function buildOrderAnalyticsReport(req, scope) {
  if (!scope || (!scope.admin && (!Number.isSafeInteger(scope.customerId) || scope.customerId <= 0))) {
    throw new Error('Report scope is required');
  }
  const personal = !scope.admin;
  const parsed = personal ? parseDispatcherQuery(req.query) : null;
  const range = parsed?.range || resolveAnalyticsRange(req.query);
  const selectedDriverId = personal ? parsed.driverId : (Number(req.query?.driverId) || null);
  const where = {
    createdAt: { [Op.between]: [range.start, range.end] },
  };

  if (personal) where.customerId = scope.customerId;

  if (selectedDriverId) {
    where[Op.or] = [
      { driverId: selectedDriverId },
      { reservedBy: selectedDriverId },
      { candidateDriverId: selectedDriverId },
    ];
  }

  const userAttributes = ["id", "name", "email", "phone", "role", "rating", "blocked", "groupId"];
  const [drivers, orders] = await Promise.all([
    personal ? Order.findAll({
      attributes: ["driverId", "reservedBy", "candidateDriverId"],
      where: { customerId: scope.customerId, createdAt: where.createdAt },
      raw: true,
    }).then(async (visibleOrders) => {
      const ids = [...new Set(visibleOrders.flatMap((o) => [o.driverId, o.reservedBy, o.candidateDriverId]).filter(Boolean))];
      return ids.length ? User.findAll({ attributes: userAttributes, where: { id: { [Op.in]: ids } }, include: [{ model: Group, as: "group" }], order: [["name", "ASC"], ["id", "ASC"]] }) : [];
    }) : User.findAll({
      attributes: userAttributes,
      where: { role: { [Op.in]: [UserRole.DRIVER, UserRole.BOTH] } },
      include: [{ model: Group, as: "group" }],
      order: [
        ["name", "ASC"],
        ["id", "ASC"],
      ],
    }),
    Order.findAll({
      attributes: personal ? ['id', 'customerId', 'driverId', 'candidateDriverId', 'reservedBy', 'status', 'createdAt', 'updatedAt', 'history', 'price', 'finalPrice', 'distance'] : undefined,
      where,
      include: [
        { model: User, as: "customer", attributes: userAttributes, include: [{ model: Group, as: "group" }] },
        { model: User, as: "driver", attributes: userAttributes, include: [{ model: Group, as: "group" }] },
        { model: User, as: "reservedDriver", attributes: userAttributes, include: [{ model: Group, as: "group" }] },
        { model: User, as: "candidateDriver", attributes: userAttributes, include: [{ model: Group, as: "group" }] },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    }),
  ]);

  const pageOrders = personal ? await Order.findAll({
    where,
    include: [
      { model: User, as: 'customer', attributes: userAttributes, include: [{ model: Group, as: 'group' }] },
      { model: User, as: 'driver', attributes: userAttributes, include: [{ model: Group, as: 'group' }] },
      { model: User, as: 'reservedDriver', attributes: userAttributes, include: [{ model: Group, as: 'group' }] },
      { model: User, as: 'candidateDriver', attributes: userAttributes, include: [{ model: Group, as: 'group' }] },
    ],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: parsed.pageSize, offset: (parsed.page - 1) * parsed.pageSize,
  }) : orders;
  const pageById = new Map(pageOrders.map((o) => [Number(o.id), o.toJSON()]));
  const orderIds = orders.map((order) => order.id);
  const customerIdsByOrder = new Map(orders.map((order) => [Number(order.id), Number(order.customerId)]));
  const customerRatingsByOrder = new Map();
  if (orderIds.length > 0) {
    const ratings = await Rating.findAll({
      attributes: ["id", "orderId", "fromUserId", "toUserId", "rating", "comment", "createdAt"],
      where: { orderId: { [Op.in]: orderIds } },
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    ratings.forEach((rating) => {
      const orderId = Number(rating.orderId);
      if (Number(rating.fromUserId) !== customerIdsByOrder.get(orderId)) return;
      if (customerRatingsByOrder.has(orderId)) return;
      customerRatingsByOrder.set(orderId, {
        id: rating.id,
        rating: Number(rating.rating),
        comment: rating.comment || null,
        createdAt: rating.createdAt,
      });
    });
  }

  const driverStats = new Map();
  const ensureDriverStats = (driver) => {
    const key = driver?.id ? String(driver.id) : "unassigned";
    if (!driverStats.has(key)) {
      driverStats.set(key, {
        driverId: driver?.id || null,
        driver: serializeReportUser(driver),
        orderCount: 0,
        completedCount: 0,
        activeCount: 0,
        cancelledCount: 0,
        totalRevenue: 0,
        totalDistanceKm: 0,
        distanceSamples: 0,
        totalDurationMinutes: 0,
        totalDurationSamples: 0,
        cargoDurationMinutes: 0,
        cargoDurationSamples: 0,
        ratingSum: 0, ratingCount: 0,
      });
    }
    return driverStats.get(key);
  };

  for (const driver of drivers) {
    if (!selectedDriverId || Number(driver.id) === selectedDriverId) {
      ensureDriverStats(driver);
    }
  }

  const orderRows = orders.map((orderModel) => {
    const order = { ...orderModel.toJSON(), ...(pageById.get(Number(orderModel.id)) || {}) };
    const driver = getReportDriver(order);
    const createdAt = new Date(order.createdAt);
    const acceptedAt = getFirstStatusDate(order, "ACCEPTED");
    const receivedAt = getFirstStatusDate(order, "IN_PROGRESS");
    const deliveredAt = getFirstStatusDate(order, "DELIVERED");
    const completedAt = getLastStatusDate(order, "COMPLETED");
    const updatedAt = new Date(order.updatedAt);
    const hasFinished = ["DELIVERED", "COMPLETED", "CANCELLED", "REJECTED"].includes(order.status);
    const finishAt = completedAt || deliveredAt || (hasFinished && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null);
    const totalDurationMinutes = minutesBetween(createdAt, finishAt);
    const cargoStartAt = receivedAt || acceptedAt || createdAt;
    const cargoFinishAt = deliveredAt || completedAt || (hasFinished && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null);
    const cargoDurationMinutes = minutesBetween(cargoStartAt, cargoFinishAt);
    const distanceKm = order.distance == null ? NaN : Number(order.distance);
    const roadDistanceKm = Number.isFinite(distanceKm) ? roundMetric(distanceKm, 1) : null;
    const revenue = toMoneyValue(order);
    const stats = ensureDriverStats(driver);
    const customerRating = customerRatingsByOrder.get(Number(order.id)) || null;

    if (customerRating && Number.isFinite(customerRating.rating)) { stats.ratingSum += customerRating.rating; stats.ratingCount += 1; }
    stats.orderCount += 1;
    stats.totalRevenue += revenue;
    if (["DELIVERED", "COMPLETED"].includes(order.status)) stats.completedCount += 1;
    if (["CANCELLED", "REJECTED"].includes(order.status)) stats.cancelledCount += 1;
    if (!["COMPLETED", "CANCELLED", "REJECTED"].includes(order.status)) stats.activeCount += 1;
    if (roadDistanceKm !== null) {
      stats.totalDistanceKm += roadDistanceKm;
      stats.distanceSamples += 1;
    }
    if (totalDurationMinutes !== null) {
      stats.totalDurationMinutes += totalDurationMinutes;
      stats.totalDurationSamples += 1;
    }
    if (cargoDurationMinutes !== null) {
      stats.cargoDurationMinutes += cargoDurationMinutes;
      stats.cargoDurationSamples += 1;
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      driverAssignment: order.driverId ? "assigned" : order.candidateDriverId ? "candidate" : order.reservedBy ? "reserved" : null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      acceptedAt,
      receivedAt,
      deliveredAt,
      completedAt,
      pickupCity: order.pickupCity,
      pickupLocation: order.pickupLocation,
      pickupAddress: order.pickupAddress,
      dropoffCity: order.dropoffCity,
      dropoffLocation: order.dropoffLocation,
      dropoffAddress: order.dropoffAddress,
      cargoType: order.cargoType,
      price: order.price,
      finalPrice: order.finalPrice,
      revenue: roundMetric(revenue, 2),
      roadDistanceKm,
      totalDurationMinutes,
      cargoDurationMinutes,
      customerRating: customerRating?.rating ?? null,
      customerRatingComment: customerRating?.comment ?? null,
      customerRatingCreatedAt: customerRating?.createdAt ?? null,
      photos: normalizePhotoList(order.photos),
      customer: serializeReportUser(order.customer),
      driver: serializeReportUser(driver),
    };
  });
  const customerRatingValues = [...customerRatingsByOrder.values()]
    .map((item) => Number(item.rating))
    .filter((value) => Number.isFinite(value));
  const customerRatingCount = customerRatingValues.length;
  const customerRatingAverage = customerRatingCount
    ? roundMetric(customerRatingValues.reduce((sum, value) => sum + value, 0) / customerRatingCount, 1)
    : null;
  const customerRatingBuckets = {
    five: customerRatingValues.filter((value) => value >= 5).length,
    four: customerRatingValues.filter((value) => value >= 4 && value < 5).length,
    threeOrLess: customerRatingValues.filter((value) => value < 4).length,
  };

  const driverRows = [...driverStats.values()]
    .map((row) => ({
      ...(personal ? { customerRatingAverage: row.ratingCount ? roundMetric(row.ratingSum / row.ratingCount, 1) : null } : {}),
      driverId: row.driverId,
      driver: row.driver,
      orderCount: row.orderCount,
      completedCount: row.completedCount,
      activeCount: row.activeCount,
      cancelledCount: row.cancelledCount,
      totalRevenue: roundMetric(row.totalRevenue, 2),
      totalDistanceKm: roundMetric(row.totalDistanceKm, 1),
      totalDurationMinutes: Math.round(row.totalDurationMinutes),
      totalCargoDurationMinutes: Math.round(row.cargoDurationMinutes),
      avgDistanceKm: row.distanceSamples ? roundMetric(row.totalDistanceKm / row.distanceSamples, 1) : null,
      avgTotalDurationMinutes: row.totalDurationSamples ? Math.round(row.totalDurationMinutes / row.totalDurationSamples) : null,
      avgCargoDurationMinutes: row.cargoDurationSamples ? Math.round(row.cargoDurationMinutes / row.cargoDurationSamples) : null,
    }))
    .filter((row) => row.orderCount > 0 || (selectedDriverId && Number(row.driverId) === selectedDriverId))
    .sort((a, b) => b.orderCount - a.orderCount || String(a.driver?.name || "").localeCompare(String(b.driver?.name || "")));

  const completedRows = orderRows.filter((row) => ["DELIVERED", "COMPLETED"].includes(row.status));
  const durations = completedRows.map((row) => row.totalDurationMinutes).filter((value) => value !== null && value > 0);
  const daily = new Map();
  for (const row of completedRows) {
    const key = new Date(row.completedAt || row.deliveredAt || row.updatedAt || row.createdAt).toISOString().slice(0, 10);
    const item = daily.get(key) || { key, count: 0, revenue: 0 };
    item.count += 1; item.revenue += row.revenue; daily.set(key, item);
  }
  return {
    generatedAt: new Date(),
    period: {
      from: range.start,
      to: range.end,
      days: range.days,
    },
    filters: {
      driverId: selectedDriverId || null,
    },
    drivers: drivers.map((driver) => serializeReportUser(driver)),
    driverRows,
    orderRows: personal ? orderRows.filter((row) => pageById.has(Number(row.id))) : orderRows,
    ...(personal ? {
      dailyRows: [...daily.values()].sort((a, b) => a.key.localeCompare(b.key)).map((row) => ({ ...row, revenue: roundMetric(row.revenue, 2) })),
      pagination: { page: parsed.page, pageSize: parsed.pageSize, total: orders.length, pages: Math.ceil(orders.length / parsed.pageSize) },
      totals: {
        averageDurationMinutes: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
        completedRevenue: roundMetric(completedRows.reduce((sum, row) => sum + row.revenue, 0), 2),
        orderCount: orders.length,
        completedCount: driverRows.reduce((sum, r) => sum + r.completedCount, 0),
        activeCount: driverRows.reduce((sum, r) => sum + r.activeCount, 0),
        cancelledCount: driverRows.reduce((sum, r) => sum + r.cancelledCount, 0),
        totalRevenue: roundMetric(driverRows.reduce((sum, r) => sum + r.totalRevenue, 0), 2),
        totalDistanceKm: roundMetric(driverRows.reduce((sum, r) => sum + r.totalDistanceKm, 0), 1),
      },
    } : {}),
    customerRatings: {
      count: customerRatingCount,
      average: customerRatingAverage,
      buckets: customerRatingBuckets,
    },
  };
}


module.exports = { buildOrderAnalyticsReport, toMoneyValue };
