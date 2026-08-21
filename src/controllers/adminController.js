const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { Op, fn, col, where } = require("sequelize");
const User = require("../models/user");
const { UserRole } = require("../models/user");
const Group = require("../models/group");
const Order = require("../models/order");
const OrderResponse = require("../models/orderResponse");
const OrderRouteSearchEvent = require("../models/orderRouteSearchEvent");
const SupportQuestion = require("../models/supportQuestion");
const { SupportQuestionStatus } = require("../models/supportQuestion");
const PortalAdmin = require("../models/portalAdmin");
const { setServiceFee } = require("../config");
const { pathToUploadUrl } = require("../utils/uploadFiles");
const { sendPush } = require("../utils/push");
const { normalizePhone } = require("../services/authCodes");

const DAY_MS = 24 * 60 * 60 * 1000;
const MATCHED_ORDER_STATUSES = ["ACCEPTED", "IN_PROGRESS", "DELIVERED", "COMPLETED"];

function buildPhoneLookupVariants(phone) {
  const normalizedPhone = normalizePhone(phone);
  const variants = new Set([normalizedPhone]);

  if (normalizedPhone.startsWith("380") && normalizedPhone.length === 12) {
    variants.add(`0${normalizedPhone.slice(3)}`);
  }

  return [...variants];
}

function phoneWhere(phone) {
  return {
    [Op.or]: buildPhoneLookupVariants(phone).map((phoneVariant) =>
      where(fn("regexp_replace", col("phone"), "[^0-9]", "", "g"), phoneVariant)
    ),
  };
}

async function findUserByPhone(phone) {
  return User.findOne({
    where: phoneWhere(phone),
    order: [["id", "DESC"]],
  });
}

function isValidPhone(phone) {
  return String(phone || "").replace(/\D/g, "").length >= 10;
}

function serializePortalAdmin(admin, linkedUser = null) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    phone: admin.phone,
    active: admin.active,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
    linkedUser: linkedUser
      ? {
          id: linkedUser.id,
          name: linkedUser.name,
          email: linkedUser.email,
          phone: linkedUser.phone,
          role: linkedUser.role,
          isAdmin: linkedUser.isAdmin,
          blocked: linkedUser.blocked,
        }
      : null,
  };
}

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
  const users = await User.findAll({
    attributes: { exclude: ["password", "pushToken"] },
    include: [{ model: Group, as: "group" }],
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
  });
  res.json(users);
}

async function listPortalAdmins(_req, res) {
  const admins = await PortalAdmin.findAll({
    attributes: { exclude: ["password"] },
    order: [
      ["active", "DESC"],
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
  });

  const payload = await Promise.all(
    admins.map(async (admin) => serializePortalAdmin(admin, admin.phone ? await findUserByPhone(admin.phone) : null))
  );
  res.json(payload);
}

async function createPortalAdmin(req, res) {
  const phoneRaw = String(req.body?.phone || "").trim();
  if (!isValidPhone(phoneRaw)) {
    res.status(400).send("Вкажіть коректний номер телефону");
    return;
  }

  const phone = normalizePhone(phoneRaw);
  let linkedUser = await findUserByPhone(phone);

  if (!linkedUser) {
    const password = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    linkedUser = await User.create({
      name: "",
      email: `user_${phone}@vango.phone`,
      password,
      phone,
      role: UserRole.BOTH,
      isAdmin: true,
    });
  } else if (!linkedUser.isAdmin || linkedUser.role === UserRole.ADMIN) {
    linkedUser.isAdmin = true;
    if (linkedUser.role === UserRole.ADMIN) {
      linkedUser.role = UserRole.BOTH;
    }
    await linkedUser.save();
  }

  const email = linkedUser.email || `portal_${phone}@vango.admin`;
  const name = linkedUser.name || linkedUser.firstName || phone;
  let admin = await PortalAdmin.findOne({ where: { phone } });
  if (!admin && email) {
    admin = await PortalAdmin.findOne({ where: { email: String(email).trim().toLowerCase() } });
  }

  if (admin) {
    admin.phone = phone;
    admin.name = admin.name || name;
    admin.email = admin.email || String(email).trim().toLowerCase();
    admin.active = true;
    await admin.save();
  } else {
    const password = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    admin = await PortalAdmin.create({
      name,
      email: String(email).trim().toLowerCase(),
      phone,
      password,
      active: true,
    });
  }

  res.status(201).json(serializePortalAdmin(admin, linkedUser));
}

async function updatePortalAdmin(req, res) {
  const admin = await PortalAdmin.findByPk(req.params.id);
  if (!admin) {
    res.status(404).send("Адміністратора не знайдено");
    return;
  }

  if (typeof req.body?.active === "boolean") {
    if (req.portalAdmin && Number(req.portalAdmin.id) === Number(admin.id) && !req.body.active) {
      res.status(400).send("Не можна вимкнути власний доступ");
      return;
    }
    admin.active = req.body.active;
  }

  await admin.save();
  const linkedUser = admin.phone ? await findUserByPhone(admin.phone) : null;
  if (linkedUser) {
    linkedUser.isAdmin = admin.active;
    if (linkedUser.role === UserRole.ADMIN) {
      linkedUser.role = UserRole.BOTH;
    }
    await linkedUser.save();
  }

  res.json(serializePortalAdmin(admin, linkedUser));
}

async function listOrders(req, res) {
  const status = typeof req.query?.status === "string" ? req.query.status.trim() : "";
  const query = typeof req.query?.q === "string" ? req.query.q.trim() : "";
  const rawLimit = Number.parseInt(req.query?.limit, 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;
  const where = {};

  if (status && status !== "ALL") {
    where.status = status;
  }

  if (query) {
    const search = `%${query}%`;
    const searchConditions = [
      { pickupLocation: { [Op.iLike]: search } },
      { dropoffLocation: { [Op.iLike]: search } },
      { pickupCity: { [Op.iLike]: search } },
      { dropoffCity: { [Op.iLike]: search } },
      { cargoType: { [Op.iLike]: search } },
    ];
    const numericQuery = Number.parseInt(query, 10);
    if (Number.isFinite(numericQuery)) {
      searchConditions.push({ id: numericQuery }, { orderNumber: numericQuery });
    }
    where[Op.or] = searchConditions;
  }

  const orders = await Order.findAll({
    where,
    limit,
    include: [
      { model: User, as: "customer", attributes: ["id", "name", "email", "phone", "role", "blocked", "groupId"], include: [{ model: Group, as: "group" }] },
      { model: User, as: "driver", attributes: ["id", "name", "email", "phone", "role", "blocked", "groupId"], include: [{ model: Group, as: "group" }] },
      { model: User, as: "reservedDriver", attributes: ["id", "name", "email", "phone", "role", "blocked", "groupId"], include: [{ model: Group, as: "group" }] },
      { model: User, as: "candidateDriver", attributes: ["id", "name", "email", "phone", "role", "blocked", "groupId"], include: [{ model: Group, as: "group" }] },
    ],
    order: [
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
  });

  const orderIds = orders.map((order) => order.id);
  const responseCounts = {};
  if (orderIds.length > 0) {
    const counts = await OrderResponse.findAll({
      attributes: ["orderId", [require("sequelize").fn("COUNT", require("sequelize").col("id")), "cnt"]],
      where: { orderId: { [Op.in]: orderIds } },
      group: ["orderId"],
      raw: true,
    });
    counts.forEach((row) => {
      responseCounts[row.orderId] = Number.parseInt(row.cnt, 10) || 0;
    });
  }

  res.json(
    orders.map((order) => {
      const json = order.toJSON();
      json.responseCount = responseCounts[json.id] || 0;
      return json;
    })
  );
}

function normalizeName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  return name || null;
}

function normalizeGroupId(value) {
  if (value === null || value === undefined || value === "") return null;
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function listGroups(_req, res) {
  const groups = await Group.findAll({
    include: [{ model: User, as: "users", attributes: ["id", "name", "phone", "email", "role", "blocked"] }],
    order: [["name", "ASC"]],
  });
  res.json(groups);
}

async function createGroup(req, res) {
  const name = normalizeName(req.body?.name);
  if (!name) {
    res.status(400).send("Вкажіть назву команди");
    return;
  }

  try {
    const group = await Group.create({
      name,
      photo: pathToUploadUrl(req.file?.path),
    });
    res.status(201).json(group);
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      res.status(409).send("Команда з такою назвою вже існує");
      return;
    }
    console.error("create group error", err);
    res.status(400).send("Не вдалося створити команду");
  }
}

async function updateGroup(req, res) {
  const { id } = req.params;
  const group = await Group.findByPk(id);
  if (!group) {
    res.status(404).send("Команду не знайдено");
    return;
  }

  const name = normalizeName(req.body?.name);
  if (name) group.name = name;
  const photo = pathToUploadUrl(req.file?.path);
  if (photo) group.photo = photo;

  try {
    await group.save();
    res.json(group);
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      res.status(409).send("Команда з такою назвою вже існує");
      return;
    }
    console.error("update group error", err);
    res.status(400).send("Не вдалося оновити команду");
  }
}

async function deleteGroup(req, res) {
  const { id } = req.params;
  const group = await Group.findByPk(id);
  if (!group) {
    res.status(404).send("Команду не знайдено");
    return;
  }

  await User.update({ groupId: null }, { where: { groupId: group.id } });
  await group.destroy();
  res.json({ deleted: true });
}

async function updateUserGroup(req, res) {
  const { id } = req.params;
  const user = await User.findByPk(id, {
    attributes: { exclude: ["password", "pushToken"] },
    include: [{ model: Group, as: "group" }],
  });
  if (!user) {
    res.status(404).send("Користувача не знайдено");
    return;
  }

  const groupId = normalizeGroupId(req.body?.groupId);
  if (groupId) {
    const group = await Group.findByPk(groupId);
    if (!group) {
      res.status(404).send("Команду не знайдено");
      return;
    }
  }

  user.groupId = groupId;
  await user.save();
  const updated = await User.findByPk(id, {
    attributes: { exclude: ["password", "pushToken"] },
    include: [{ model: Group, as: "group" }],
  });
  res.json(updated);
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

async function listSupportQuestions(req, res) {
  const status = String(req.query?.status || "ALL").toUpperCase();
  const q = String(req.query?.q || "").trim();
  const limit = Math.min(Number.parseInt(req.query?.limit, 10) || 200, 500);
  const where = {};

  if (Object.values(SupportQuestionStatus).includes(status)) {
    where.status = status;
  }

  if (q) {
    where.question = { [Op.iLike]: `%${q}%` };
  }

  const items = await SupportQuestion.findAll({
    where,
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "name", "firstName", "lastName", "phone", "email", "role"],
      },
    ],
    order: [["createdAt", "DESC"]],
    limit,
  });

  res.json(items);
}

async function updateSupportQuestion(req, res) {
  const item = await SupportQuestion.findByPk(req.params.id);
  if (!item) {
    res.status(404).send("Звернення не знайдено");
    return;
  }

  const status = String(req.body?.status || "").toUpperCase();
  const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : undefined;
  const hadAnswer = Boolean(item.answer);

  if (status && !Object.values(SupportQuestionStatus).includes(status)) {
    res.status(400).send("Некоректний статус звернення");
    return;
  }

  if (answer !== undefined) {
    item.answer = answer || null;
    if (answer) {
      item.status = SupportQuestionStatus.ANSWERED;
      if (!item.answeredAt) {
        item.answeredAt = new Date();
      }
    } else if (!status) {
      item.status = SupportQuestionStatus.OPEN;
      item.answeredAt = null;
    }
  }

  if (status) {
    item.status = status;
    if (status === SupportQuestionStatus.OPEN) {
      item.answeredAt = null;
    } else if (status === SupportQuestionStatus.ANSWERED && !item.answeredAt) {
      item.answeredAt = new Date();
    }
  }

  await item.save();

  if (answer && !hadAnswer) {
    const user = await User.findByPk(item.userId);
    if (user?.pushToken && user.pushConsent) {
      sendPush(
        user.pushToken,
        "Відповідь від підтримки VanGo",
        "Розробники відповіли на ваше питання. Відкрийте звернення в застосунку.",
        { navigateTo: "SupportRequest", supportQuestionId: item.id, recipientUserId: item.userId }
      );
    }
  }

  const updated = await SupportQuestion.findByPk(item.id, {
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "name", "firstName", "lastName", "phone", "email", "role"],
      },
    ],
  });
  res.json(updated);
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
  listPortalAdmins,
  createPortalAdmin,
  updatePortalAdmin,
  listOrders,
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  updateUserGroup,
  blockDriver,
  unblockDriver,
  updateServiceFee,
  listSupportQuestions,
  updateSupportQuestion,
  analytics,
  analyticsOverview,
  analyticsGmv,
  analyticsActiveUsers,
  analyticsLiquidity,
  analyticsRetention,
};
