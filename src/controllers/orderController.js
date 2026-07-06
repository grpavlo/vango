const Order = require("../models/order");

const { OrderStatus, RequestedOrderType, TimingOption } = require("../models/order");

const Transaction = require("../models/transaction");

const User = require("../models/user");

const DriverProfile = require("../models/driverProfile");
const SavedSearch = require("../models/savedSearch");
const OrderRouteSearchEvent = require("../models/orderRouteSearchEvent");

const { SERVICE_FEE_PERCENT } = require("../config");

const { broadcastOrder, broadcastDelete } = require("../ws");
const { sendPush } = require("../utils/push");
const { getCompletedOrderCounts, getRoleRatings } = require("../utils/ratingStats");
const {
  getOrderLifecycle,
  getLifecycleCutoffDate,
  startOfDay,
} = require("../utils/orderLifecycle");



const PRICE_HISTORY_STATUS = "PRICE_UPDATED";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CUSTOMER_IN_PROGRESS_HISTORY_DELAY_MS = 3 * DAY_IN_MS;

function collectUserRatingId(user, ids) {
  if (!user?.id) return;
  ids.push(user.id);
}

async function applyRoleRatingsToOrderJsons(orderJsons) {
  const list = Array.isArray(orderJsons) ? orderJsons : [orderJsons].filter(Boolean);
  const customerIds = [];
  const driverIds = [];

  list.forEach((order) => {
    collectUserRatingId(order.customer, customerIds);
    collectUserRatingId(order.driver, driverIds);
    collectUserRatingId(order.candidateDriver, driverIds);
    collectUserRatingId(order.reservedDriver, driverIds);
  });

  const [
    customerRatings,
    driverRatings,
    customerCompletedOrders,
    driverCompletedOrders,
  ] = await Promise.all([
    getRoleRatings(customerIds, "CUSTOMER"),
    getRoleRatings(driverIds, "DRIVER"),
    getCompletedOrderCounts(customerIds, "CUSTOMER"),
    getCompletedOrderCounts(driverIds, "DRIVER"),
  ]);

  list.forEach((order) => {
    if (order.customer?.id) {
      order.customer.rating = customerRatings[order.customer.id] ?? 5;
      order.customer.completedOrders = customerCompletedOrders[order.customer.id] ?? 0;
      order.customerRating = order.customer.rating;
      order.customerCompletedOrders = order.customer.completedOrders;
    }
    ["driver", "candidateDriver", "reservedDriver"].forEach((key) => {
      if (order[key]?.id) {
        order[key].rating = driverRatings[order[key].id] ?? 5;
        order[key].completedOrders = driverCompletedOrders[order[key].id] ?? 0;
      }
    });
  });

  return Array.isArray(orderJsons) ? list : list[0];
}



const roundPriceValue = (value) => {

  if (value === null || value === undefined) return null;

  const num = Number(value);

  return Number.isFinite(num) ? Math.round(num) : null;

};

const normalizeBoolean = (value) =>
  value === true ||
  value === "true" ||
  value === "1" ||
  value === 1 ||
  value === "on";

function buildFreeDateSchedule(baseDate = new Date()) {
  const loadFrom = new Date(baseDate);
  const loadTo = new Date(loadFrom.getTime() + 60 * 60 * 1000);
  const freeDateUntil = new Date(loadFrom.getTime() + 7 * DAY_IN_MS);
  const unloadFrom = new Date(freeDateUntil);
  const unloadTo = new Date(freeDateUntil.getTime() + 60 * 60 * 1000);
  return { loadFrom, loadTo, unloadFrom, unloadTo, freeDateUntil };
}
function parseOrderHistory(history) {
  if (Array.isArray(history)) return history;
  if (typeof history === "string") {
    try {
      const parsed = JSON.parse(history);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getLatestStatusTimeMs(order, status) {
  const history = parseOrderHistory(order?.history);
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (!entry || entry.status !== status || !entry.at) continue;
    const ms = new Date(entry.at).getTime();
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  const fallbackMs = new Date(order?.updatedAt || 0).getTime();
  return Number.isFinite(fallbackMs) && fallbackMs > 0 ? fallbackMs : 0;
}

function canCustomerMoveInProgressOrderToHistory(order, user, now = new Date()) {
  if (!order || !user) return false;
  if (order.customerId !== user.id) return false;
  if (order.status !== OrderStatus.IN_PROGRESS) return false;
  const inProgressAtMs = getLatestStatusTimeMs(order, OrderStatus.IN_PROGRESS);
  if (!inProgressAtMs) return false;
  return now.getTime() - inProgressAtMs >= CUSTOMER_IN_PROGRESS_HISTORY_DELAY_MS;
}



const appendPriceHistory = (

  order,

  previousValue,

  nextValue,

  field,

  actorRole,

  actorId

) => {

  const toPrice = roundPriceValue(nextValue);

  if (toPrice === null) return;

  const fromPrice = roundPriceValue(previousValue);

  if (fromPrice !== null && fromPrice === toPrice) return;

  const entry = {

    status: PRICE_HISTORY_STATUS,

    at: new Date(),

    field,

    toPrice,

  };

  if (fromPrice !== null) entry.fromPrice = fromPrice;

  if (actorRole) entry.changedByRole = actorRole;

  if (actorId) entry.changedById = actorId;

  order.history = [...(order.history || []), entry];

};

// ?'???????"???? ???-?�???�?�???? ???�?, ?? UTC ?�?� ?,?�?????,???????? ???�???�???�?,?????? `date` (DD.MM ?�?�?? DD.MM.YYYY),
// ?????� ?"?-?�???,?? ???� ?�?�?�?�?�?�?? ???-?? ?�?????�?�?????????? ???�???????????? ?????????? ???�?????�???�.
function buildUtcDayRange(dateStr) {
  const { parseDate } = require("../utils/date");
  const parsed = parseDate(dateStr);
  if (!parsed) return null;
  const y = parsed.getFullYear();
  const m = parsed.getMonth();
  const d = parsed.getDate();
  const start = new Date(Date.UTC(y, m, d));
  const end = new Date(Date.UTC(y, m, d + 1));
  return { start, end };
}

// ?"?-?�???�?�???? ?� dateFrom ???? dateTo (DD.MM ?�?�?? DD.MM.YYYY).
// ???????�???,?�?" { start, end } ???�?? ?"?-?�???,???� loadFrom.
function buildUtcDateRange(dateFromStr, dateToStr) {
  const { parseDate } = require("../utils/date");
  const fromParsed = parseDate(dateFromStr);
  const toParsed = parseDate(dateToStr || dateFromStr);
  if (!fromParsed || !toParsed) return null;
  const y1 = fromParsed.getFullYear();
  const m1 = fromParsed.getMonth();
  const d1 = fromParsed.getDate();
  const y2 = toParsed.getFullYear();
  const m2 = toParsed.getMonth();
  const d2 = toParsed.getDate();
  const start = new Date(Date.UTC(y1, m1, d1));
  const end = new Date(Date.UTC(y2, m2, d2 + 1));
  if (end <= start) return null;
  return { start, end };
}

function formatDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function trackRouteSearchForOrders(orderIds, driverId, now = new Date()) {
  if (!Array.isArray(orderIds) || orderIds.length === 0 || !driverId) return;
  const dayKey = formatDayKey(now);
  const rows = orderIds.map((orderId) => ({ orderId, driverId, dayKey }));
  try {
    await OrderRouteSearchEvent.bulkCreate(rows, { ignoreDuplicates: true });
  } catch (err) {
    // fallback for dialects/configs where ignoreDuplicates may be unavailable
    for (const row of rows) {
      await OrderRouteSearchEvent.findOrCreate({
        where: row,
        defaults: row,
      });
    }
  }
}

function attachOrderLifecycleMeta(order, now = new Date()) {
  const json = order.toJSON ? order.toJSON() : { ...order };
  const lifecycle = getOrderLifecycle(json, now);
  json.isDateOutdated = lifecycle.isStale;
  json.staleDays = lifecycle.staleDays;
  json.staleSince = lifecycle.staleSince;
  json.isLowPriority = lifecycle.isLowPriority;
  return json;
}

function buildAvailableDateCondition({ date, dateFrom, dateTo }, now, Op) {
  const lifecycleCutoff = getLifecycleCutoffDate(now);
  const todayStart = startOfDay(now);

  const freeDateWindowCondition = {
    freeDate: true,
    freeDateUntil: { [Op.gte]: lifecycleCutoff },
  };

  const regularOrderCondition = {
    freeDate: { [Op.not]: true },
  };
  const staleRegularCondition = {
    ...regularOrderCondition,
    unloadTo: { [Op.gte]: lifecycleCutoff, [Op.lt]: todayStart },
  };

  if (dateFrom && dateTo) {
    const range = buildUtcDateRange(dateFrom, dateTo);
    if (range) {
      return {
        [Op.or]: [
          freeDateWindowCondition,
          {
            ...regularOrderCondition,
            [Op.or]: [
              { loadFrom: { [Op.gte]: range.start, [Op.lt]: range.end } },
              staleRegularCondition,
            ],
          },
        ],
      };
    }
  } else if (date) {
    const range = buildUtcDayRange(date);
    if (range) {
      return {
        [Op.or]: [
          freeDateWindowCondition,
          {
            ...regularOrderCondition,
            [Op.or]: [
              {
                loadFrom: { [Op.gte]: range.start },
                loadTo: { [Op.lt]: range.end },
              },
              staleRegularCondition,
            ],
          },
        ],
      };
    }
  }

  return {
    [Op.or]: [
      freeDateWindowCondition,
      {
        ...regularOrderCondition,
        unloadTo: { [Op.gte]: lifecycleCutoff },
      },
    ],
  };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeCity(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function isIntraCityRoute(pickupCity, dropoffCity) {
  const pickup = normalizeCity(pickupCity);
  const dropoff = normalizeCity(dropoffCity);
  return Boolean(pickup && dropoff && pickup === dropoff);
}

function normalizeRequestedOrderType(value) {
  return Object.values(RequestedOrderType).includes(value) ? value : null;
}

function normalizeTimingOption(value) {
  return Object.values(TimingOption).includes(value) ? value : null;
}

function isEffectiveIntraCity(requestedOrderType, pickupCity, dropoffCity) {
  return (
    requestedOrderType === RequestedOrderType.LOCAL ||
    isIntraCityRoute(pickupCity, dropoffCity)
  );
}

function orderMatchesSavedSearch(order, savedSearch) {
  const orderCity = normalizeCity(order.pickupCity);
  const searchCity = normalizeCity(savedSearch.pickupCity);
  if (!orderCity || !searchCity || !orderCity.includes(searchCity)) {
    return false;
  }

  if (
    !Number.isFinite(Number(order.pickupLat)) ||
    !Number.isFinite(Number(order.pickupLon))
  ) {
    return false;
  }

  const savedDropoffCity = normalizeCity(savedSearch.dropoffCity);
  if (savedDropoffCity) {
    const orderDropoffCity = normalizeCity(order.dropoffCity);
    if (!orderDropoffCity || !orderDropoffCity.includes(savedDropoffCity)) {
      return false;
    }
  }

  const hasDropoffPoint =
    Number.isFinite(Number(savedSearch.dropoffLat)) &&
    Number.isFinite(Number(savedSearch.dropoffLon));
  if (hasDropoffPoint) {
    if (
      !Number.isFinite(Number(order.dropoffLat)) ||
      !Number.isFinite(Number(order.dropoffLon))
    ) {
      return false;
    }

    const inDropoffRadius =
      haversineKm(
        Number(savedSearch.dropoffLat),
        Number(savedSearch.dropoffLon),
        Number(order.dropoffLat),
        Number(order.dropoffLon)
      ) <= Number(savedSearch.radius);

    if (!inDropoffRadius) {
      return false;
    }
  }

  return (
    haversineKm(
      Number(savedSearch.lat),
      Number(savedSearch.lon),
      Number(order.pickupLat),
      Number(order.pickupLon)
    ) <= Number(savedSearch.radius)
  );
}

async function notifyDriversAboutSavedSearchMatch(order) {
  const savedSearches = await SavedSearch.findAll({
    include: [{ model: User, as: "driver" }],
  });
  const notifiedDriverIds = new Set();

  for (const savedSearch of savedSearches) {
    if (!orderMatchesSavedSearch(order, savedSearch)) continue;

    const driver = savedSearch.driver;
    if (!driver?.pushToken || !driver.pushConsent) continue;
    if (notifiedDriverIds.has(driver.id)) continue;
    notifiedDriverIds.add(driver.id);

    sendPush(
      driver.pushToken,
      "\u041d\u043e\u0432\u0435 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0437\u0430 \u0432\u0430\u0448\u0438\u043c \u043a\u0440\u0438\u0442\u0435\u0440\u0456\u0454\u043c",
      `${order.pickupCity || "\u041c\u0456\u0441\u0442\u043e \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f"} - ${Math.round(
        Number(savedSearch.radius)
      )} \u043a\u043c`,
      { orderId: order.id, navigateTo: "orderDetail" }
    );
  }
}



const userIncludeWithProfile = (alias) => ({

  model: User,

  as: alias,

  include: [{ model: DriverProfile, as: "driverProfile" }],

});



async function createOrder(req, res) {

  const {

    pickupLocation,

    dropoffLocation,

    pickupCountry,

    pickupCity,

    pickupAddress,

    pickupPostcode,

    dropoffCountry,

    dropoffCity,

    dropoffAddress,

    dropoffPostcode,

    cargoType,

    loadFrom,

    loadTo,

    unloadFrom,

    unloadTo,

    pickupLat,

    pickupLon,

    dropoffLat,

    dropoffLon,

    loadHelp,

    unloadHelp,

    freeDate,

    requestedOrderType,

    timingOption,

    payment,

    agreedPrice,

    insurance,

  } = req.body;

  let systemPrice = 0;

  let price = 0;
  const isAgreedPrice = normalizeBoolean(agreedPrice);
  const normalizedRequestedOrderType = normalizeRequestedOrderType(requestedOrderType);
  const normalizedTimingOption =
    normalizedRequestedOrderType === RequestedOrderType.LOCAL
      ? normalizeTimingOption(timingOption) || TimingOption.ASAP
      : null;
  const intraCity = isEffectiveIntraCity(
    normalizedRequestedOrderType,
    pickupCity,
    dropoffCity
  );
  const submittedPrice = parseFloat(req.body.price);
  if (!intraCity && !isAgreedPrice && Number.isFinite(submittedPrice)) {
    price = submittedPrice;
  }

  try {

    if (pickupLat && pickupLon && dropoffLat && dropoffLon) {

      const resRoute = await fetch(

        `https://router.project-osrm.org/route/v1/driving/${pickupLon},${pickupLat};${dropoffLon},${dropoffLat}?overview=false`

      );

      const data = await resRoute.json();

      if (data.routes && data.routes[0]) {

        const km = data.routes[0].distance / 1000;

        systemPrice = km * 50;

        if (intraCity || isAgreedPrice) {
          price = 0;
        } else {
          price = parseFloat(req.body.price || systemPrice);
        }

      }

    }

    const { cargoLength, cargoWidth, cargoHeight, cargoVolume, cargoWeight, distance } = req.body;
    const isFreeDate = normalizeBoolean(freeDate);
    const freeDateSchedule = isFreeDate ? buildFreeDateSchedule() : null;
    if (!intraCity && !isAgreedPrice && (!Number.isFinite(price) || price <= 0)) {
      return res.status(400).send("\u0412\u043a\u0430\u0436\u0456\u0442\u044c \u0446\u0456\u043d\u0443 \u0430\u0431\u043e \u043e\u0431\u0435\u0440\u0456\u0442\u044c \u0434\u043e\u0433\u043e\u0432\u0456\u0440\u043d\u0443 \u0446\u0456\u043d\u0443");
    }

    const order = await Order.create({

      customerId: req.user.id,

      pickupLocation,

      dropoffLocation,

      pickupCountry,

      pickupCity,

      isIntraCity: intraCity,

      requestedOrderType: normalizedRequestedOrderType,

      timingOption: normalizedTimingOption,

      pickupAddress,

      pickupPostcode,

      dropoffCountry,

      dropoffCity,

      dropoffAddress,

      dropoffPostcode,

      cargoType,

      pickupLat,

      pickupLon,

      dropoffLat,

      dropoffLon,

      loadHelp: normalizeBoolean(loadHelp),

      unloadHelp: normalizeBoolean(unloadHelp),

      freeDate: isFreeDate,

      freeDateUntil: isFreeDate
        ? new Date(req.body.freeDateUntil || freeDateSchedule.freeDateUntil)
        : null,

      payment,

      loadFrom: isFreeDate ? new Date(loadFrom || freeDateSchedule.loadFrom) : loadFrom,

      loadTo: isFreeDate ? new Date(loadTo || freeDateSchedule.loadTo) : loadTo,

      unloadFrom: isFreeDate ? new Date(unloadFrom || freeDateSchedule.unloadFrom) : unloadFrom,

      unloadTo: isFreeDate ? new Date(unloadTo || freeDateSchedule.unloadTo) : unloadTo,

      insurance,

      systemPrice,

      price,

      agreedPrice: isAgreedPrice,

      distance: distance ? parseFloat(distance) : null,

      cargoLength: cargoLength ? parseFloat(cargoLength) : null,

      cargoWidth: cargoWidth ? parseFloat(cargoWidth) : null,

      cargoHeight: cargoHeight ? parseFloat(cargoHeight) : null,

      cargoVolume: cargoVolume ? parseFloat(cargoVolume) : null,

      cargoWeight: cargoWeight ? parseFloat(cargoWeight) : null,

      photos: req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [],

      history: [{ status: "CREATED", at: new Date() }],

    });

    if (!order.orderNumber) {
      order.orderNumber = order.id;
      await order.save();
    }

    broadcastOrder(order);
    await notifyDriversAboutSavedSearchMatch(order);
    res.json(order);

  } catch (err) {

    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0441\u0442\u0432\u043e\u0440\u0438\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");

  }

}



async function listAvailableOrders(req, res) {

  const { city, pickupCity, dropoffCity, date, dateFrom, dateTo, lat, lon, radius, dropoffLat, dropoffLon, dropoffRadius, corridorWidth } = req.query;

  const { Op } = require("sequelize");



  const where = {

    [Op.or]: [

      { status: "CREATED" },

      { status: "PENDING", candidateDriverId: req.user.id },

    ],

  };

  const hasRadiusQuery = lat != null && lon != null && radius != null && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon)) && parseFloat(radius) > 0;
  const hasDropoffRadiusQuery = dropoffLat != null && dropoffLon != null && dropoffRadius != null && !isNaN(parseFloat(dropoffLat)) && !isNaN(parseFloat(dropoffLon)) && parseFloat(dropoffRadius) > 0;
  const platA = parseFloat(lat);
  const plonA = parseFloat(lon);
  const platB = parseFloat(dropoffLat);
  const plonB = parseFloat(dropoffLon);
  const dKm = corridorWidth ? parseFloat(corridorWidth) : 50;
  const hasCorridorQuery = !isNaN(platA) && !isNaN(plonA) && !isNaN(platB) && !isNaN(plonB);

  const useGeometryFilter = hasRadiusQuery || hasDropoffRadiusQuery || hasCorridorQuery;

  if (!useGeometryFilter) {
    const cityFilter = pickupCity || city;
    if (cityFilter) where.pickupCity = cityFilter;
  }
  if (!useGeometryFilter && dropoffCity) {
    where.dropoffCity = dropoffCity;
  }



  const now = new Date();

  const andConditions = [
    {
      [Op.or]: [
        { reservedBy: null },
        { reservedUntil: { [Op.lt]: now } },
        { reservedBy: req.user.id },
      ],
    },
  ];

  andConditions.push(buildAvailableDateCondition({ date, dateFrom, dateTo }, now, Op));

  where[Op.and] = andConditions;

  const orders = await Order.findAll({
    where,
    include: [{ model: User, as: "customer", attributes: ["id", "name", "rating"] }],
  });



  const centerLat = parseFloat(lat);
  const centerLon = parseFloat(lon);
  const searchRadius = radius ? parseFloat(radius) : null;
  const dLat = parseFloat(dropoffLat);
  const dLon = parseFloat(dropoffLon);
  const dRadius = dropoffRadius ? parseFloat(dropoffRadius) : null;

  function toXY(lat, lon, lat0) {
    const kLat = 111.0;
    const kLon = 111.0 * Math.cos((lat0 * Math.PI) / 180);
    return { x: lon * kLon, y: lat * kLat };
  }

  function isInsideCorridor(P, A, B, dKm) {
    const lat0 = (A.lat + B.lat) / 2;
    const a = toXY(A.lat, A.lon, lat0);
    const b = toXY(B.lat, B.lon, lat0);
    const p = toXY(P.lat, P.lon, lat0);
    const vx = b.x - a.x, vy = b.y - a.y;
    const L = Math.hypot(vx, vy) || 1;
    const ux = vx / L, uy = vy / L;
    const nx = -uy, ny = ux;
    const t = (p.x - a.x) * ux + (p.y - a.y) * uy;
    const s = (p.x - a.x) * nx + (p.y - a.y) * ny;
    return t >= 0 && t <= L && Math.abs(s) <= dKm;
  }

  function inRadius(order) {
    if (hasRadiusQuery && searchRadius && !isNaN(centerLat) && !isNaN(centerLon) && order.pickupLat && order.pickupLon) {
      const dist = haversineKm(centerLat, centerLon, order.pickupLat, order.pickupLon);
      if (dist <= searchRadius) return true;
    }
    if (hasDropoffRadiusQuery && dRadius && !isNaN(dLat) && !isNaN(dLon) && order.dropoffLat && order.dropoffLon) {
      const dist = haversineKm(dLat, dLon, order.dropoffLat, order.dropoffLon);
      if (dist <= dRadius) return true;
    }
    if (hasCorridorQuery && order.pickupLat && order.pickupLon) {
      const P = { lat: order.pickupLat, lon: order.pickupLon };
      const A = { lat: platA, lon: plonA };
      const B = { lat: platB, lon: plonB };
      if (isInsideCorridor(P, A, B, dKm)) return true;
    }
    return !hasRadiusQuery && !hasDropoffRadiusQuery && !hasCorridorQuery;
  }

  const filtered = orders.filter(inRadius);
  const nowForLifecycle = new Date();

  const OrderResponse = require("../models/orderResponse");
  const { Op: SeqOp } = require("sequelize");
  const orderIds = filtered.map((o) => o.id);
  await trackRouteSearchForOrders(orderIds, req.user.id, nowForLifecycle);

  let responseCounts = {};
  if (orderIds.length > 0) {
    const counts = await OrderResponse.findAll({
      attributes: ["orderId", [require("sequelize").fn("COUNT", require("sequelize").col("id")), "cnt"]],
      where: { orderId: { [SeqOp.in]: orderIds }, status: { [SeqOp.in]: ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING", "COUNTER_OFFERED"] } },
      group: ["orderId"],
      raw: true,
    });
    counts.forEach((c) => { responseCounts[c.orderId] = parseInt(c.cnt); });
  }
  const enriched = filtered.map((o) => {
    const json = attachOrderLifecycleMeta(o, nowForLifecycle);
    json.responseCount = responseCounts[json.id] || 0;
    return json;
  });
  await applyRoleRatingsToOrderJsons(enriched);
  enriched.sort((a, b) => {
    if (Boolean(a.isLowPriority) !== Boolean(b.isLowPriority)) {
      return a.isLowPriority ? 1 : -1;
    }
    if (Boolean(a.isDateOutdated) !== Boolean(b.isDateOutdated)) {
      return a.isDateOutdated ? 1 : -1;
    }
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  const takenOrders = await Order.findAll({

    where: { status: "ACCEPTED" },

    limit: Math.floor(filtered.length / 15),

  });

  res.json({ available: enriched, taken: takenOrders });

}



async function listMyOrders(req, res) {

  const { Op } = require("sequelize");

  const role = req.query.role || req.user.role;

  const now = new Date();

  let where = {};

  if (role === "CUSTOMER") {

    where.customerId = req.user.id;

  } else if (role === "DRIVER") {

    where = {

      [Op.or]: [

        { driverId: req.user.id },

        { reservedBy: req.user.id, reservedUntil: { [Op.gt]: now } },

        { candidateDriverId: req.user.id },

      ],

    };

  } else if (role === "BOTH" || !role) {

    where = {

      [Op.or]: [

        { customerId: req.user.id },

        { driverId: req.user.id },

        { reservedBy: req.user.id, reservedUntil: { [Op.gt]: now } },

        { candidateDriverId: req.user.id },

      ],

    };

  }

  const OrderResponse = require("../models/orderResponse");
  const { Op: SeqOp } = require("sequelize");

  // For drivers, also include orders they have active responses to
  if (role === "DRIVER" || role === "BOTH" || !role) {
    const activeResponses = await OrderResponse.findAll({
      attributes: ["orderId"],
      where: {
        driverId: req.user.id,
        status: { [SeqOp.in]: ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING", "COUNTER_OFFERED"] },
      },
      raw: true,
    });
    const respondedOrderIds = activeResponses.map((r) => r.orderId);
    if (respondedOrderIds.length > 0) {
      if (where[Op.or]) {
        where[Op.or].push({ id: { [Op.in]: respondedOrderIds } });
      } else {
        where = { [Op.or]: [where, { id: { [Op.in]: respondedOrderIds } }] };
      }
    }
  }

  const orders = await Order.findAll({

    where,

    include: [

      userIncludeWithProfile("driver"),

      userIncludeWithProfile("candidateDriver"),

      userIncludeWithProfile("reservedDriver"),

      { model: User, as: "customer" },

    ],

  });

  const myOrderIds = orders.map((o) => o.id);
  let myResponseCounts = {};
  if (myOrderIds.length > 0) {
    const counts = await OrderResponse.findAll({
      attributes: ["orderId", [require("sequelize").fn("COUNT", require("sequelize").col("id")), "cnt"]],
      where: { orderId: { [SeqOp.in]: myOrderIds }, status: { [SeqOp.in]: ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING", "COUNTER_OFFERED"] } },
      group: ["orderId"],
      raw: true,
    });
    counts.forEach((c) => { myResponseCounts[c.orderId] = parseInt(c.cnt); });
  }

  // For drivers, attach their personal response status to each order
  let myResponseStatuses = {};
  if (role === "DRIVER" || role === "BOTH" || !role) {
    if (myOrderIds.length > 0) {
      const myResps = await OrderResponse.findAll({
        attributes: ["orderId", "status"],
        where: {
          driverId: req.user.id,
          orderId: { [SeqOp.in]: myOrderIds },
          status: { [SeqOp.in]: ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING", "COUNTER_OFFERED", "CONFIRMED"] },
        },
        raw: true,
      });
      myResps.forEach((r) => { myResponseStatuses[r.orderId] = r.status; });
    }
  }

  const enrichedOrders = await applyRoleRatingsToOrderJsons(orders.map((o) => {
    const json = o.toJSON();
    json.responseCount = myResponseCounts[json.id] || 0;
    json.myResponseStatus = myResponseStatuses[json.id] || null;
    return json;
  }));

  res.json(enrichedOrders);

}



async function getOrder(req, res) {

  const id = req.params.id;

  try {
    const OrderResponse = require("../models/orderResponse");

    const order = await Order.findByPk(id, {

      include: [

        userIncludeWithProfile("driver"),

        userIncludeWithProfile("candidateDriver"),

        userIncludeWithProfile("reservedDriver"),

        { model: User, as: "customer" },

      ],

    });

    if (!order) {

      return res.status(404).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");

    }

    const responseCount = await OrderResponse.count({
      where: {
        orderId: id,
        status: { [require("sequelize").Op.in]: ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING", "COUNTER_OFFERED"] },
      },
    });

    const json = await applyRoleRatingsToOrderJsons(order.toJSON());
    json.responseCount = responseCount;
    res.json(json);

  } catch (err) {

    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043e\u0442\u0440\u0438\u043c\u0430\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");

  }

}



async function reserveOrder(req, res) {

  const orderId = req.params.id;

  try {

    const order = await Order.findByPk(orderId, {

      include: { model: require("../models/user"), as: "customer" },

    });

    if (!order || order.status !== "CREATED") {

      return res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0432\u0436\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0435");

    }

    const prevFinalPriceForHistory = order.finalPrice;

    const prevBasePriceForHistory = order.price;



    // ??'? ???????-?? ?????�?� ?�?�?????????????????�?,?? ?"?-???�?�?????? ???-???? ???-?? ???�?? ???�?�?�?????? ?????>?�???� ???????? agreedPrice === true

    if (req.body && req.body.finalPrice != null) {

      // ???�???�???-?????�: ???????-?? ?????�?� ?????,?�???????�?????�?,?? ?"?-???�?�?????? ???-???? ?,?-?�?????? ???????? ?�?�???????�?�?????? ?� ???????????-???????? ???-??????

      if (!order.agreedPrice) {

        return res.status(400).send("\u0412\u043e\u0434\u0456\u0439 \u043c\u043e\u0436\u0435 \u0432\u0438\u0441\u0442\u0430\u0432\u0438\u0442\u0438 \u0444\u0456\u043d\u0430\u043b\u044c\u043d\u0443 \u0446\u0456\u043d\u0443 \u043b\u0438\u0448\u0435 \u0434\u043b\u044f \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u044c \u0431\u0435\u0437 \u0444\u0456\u043a\u0441\u043e\u0432\u0430\u043d\u043e\u0457 \u0446\u0456\u043d\u0438");

      }

      const normalized = roundPriceValue(req.body.finalPrice);

      if (normalized !== null) {

        const previousValue =

          prevFinalPriceForHistory !== null &&

          prevFinalPriceForHistory !== undefined

            ? prevFinalPriceForHistory

            : prevBasePriceForHistory;

        appendPriceHistory(

          order,

          previousValue,

          normalized,

          "finalPrice",

          "DRIVER",

          req.user.id

        );

        order.finalPrice = normalized;

      }

    }



    const now = new Date();

    if (

      order.reservedBy &&

      order.reservedUntil &&

      order.reservedUntil > now &&

      order.reservedBy !== req.user.id

    ) {

      return res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0432\u0436\u0435 \u0437\u0430\u0440\u0435\u0437\u0435\u0440\u0432\u043e\u0432\u0430\u043d\u0435");

    }

    order.reservedBy = req.user.id;

    order.reservedUntil = new Date(now.getTime() + 10 * 60000);

    await order.save();

    broadcastOrder(order);

    if (

      order.customer &&

      order.customer.pushToken &&

      order.customer.pushConsent

    ) {

      const { sendPush } = require("../utils/push");

      sendPush(

        order.customer.pushToken,

        "\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0443 \u0440\u0435\u0437\u0435\u0440\u0432\u0456",

        "\u0412\u043e\u0434\u0456\u0439 \u0432\u0437\u044f\u0432 \u0432\u0430\u0448\u0435 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0432 \u0440\u0435\u0437\u0435\u0440\u0432",

        { orderId: order.id, navigateTo: "orderDetail" }

      );

    }

    res.json({

      order,

      phone: order.customer ? order.customer.phone : null,

      name: order.customer ? order.customer.name : null,

    });

  } catch (err) {

    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0430\u0440\u0435\u0437\u0435\u0440\u0432\u0443\u0432\u0430\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");

  }

}



async function cancelReserve(req, res) {

  const orderId = req.params.id;



  try {

    const order = await Order.findByPk(orderId);



    // 1?????? ???�???�???-?????� ?????�?? ???????,??????

    if (

      !order ||

      (order.reservedBy !== req.user.id && order.customerId !== req.user.id)

    ) {

      return res.status(400).send("\u041d\u0435\u043c\u0430\u0454 \u043f\u0440\u0430\u0432 \u0430\u0431\u043e \u043d\u0435\u043c\u0430\u0454 \u0434\u0430\u043d\u0438\u0445");

    }



    const prevStatus = order.status;



    // 2?????? ?????????,???� ?????�?-?? ???�?�?�??????

    order.reservedBy = null;

    order.reservedUntil = null;

    order.candidateDriverId = null;

    order.candidateUntil = null;



    // ???????? ???????-?? ???�?� ?�???? ??????????T???�?�??????, ?�???-???�?"???? ?- ????????

    if (order.driverId && order.status === "RESERVED") {

      order.driverId = null;

    }



    // 3?????? ?????????�???"???? ???,?�?,???? ?�?????� ???????? ???-?? ?�???? ?-????????

    if (prevStatus !== "CREATED") {

      order.status = "CREATED";

      order.history = [

        ...(order.history || []),

        { status: "CREATED", at: new Date(), note: "\u0420\u0435\u0437\u0435\u0440\u0432 \u0441\u043a\u0430\u0441\u043e\u0432\u0430\u043d\u043e", changedByRole: req.user?.role, changedById: req.user?.id },

      ];

    }



    await order.save();



    // 4?????? ?-?�???�???,?�?�???"???? ?????????�?�?????? ???�??T?"???, ?� ?????-???� ?�????T???�???�????

    const updated = await Order.findByPk(orderId, {

      include: [{ model: require("../models/user"), as: "customer" }],

    });



    // 5?????? ?????????-???�?"???? ?"???????, ?????? ?????????�?�??????

    broadcastOrder(updated);



    res.json(updated);

  } catch (err) {

    console.error("??? cancelReserve error:", err);

    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0441\u043a\u0430\u0441\u0443\u0432\u0430\u0442\u0438 \u0440\u0435\u0437\u0435\u0440\u0432");

  }

}



async function updateFinalPrice(req, res) {

  const orderId = req.params.id;

  const { finalPrice } = req.body;



  try {

    const order = await Order.findByPk(orderId);

    if (!order) return res.status(404).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");



    // ??'? ?>?????� ?�?�???????????? ?????�?� ?�???-???????�?,?? ???-????, ???????? ???� ???-???,???�???????? ???????-??

    if (order.customerId !== req.user.id || !["CREATED", "PENDING"].includes(order.status)) {

      return res.status(400).send("\u041d\u0435 \u043c\u043e\u0436\u043d\u0430 \u043e\u043d\u043e\u0432\u0438\u0442\u0438 \u0444\u0456\u043d\u0430\u043b\u044c\u043d\u0443 \u0446\u0456\u043d\u0443 \u0434\u043b\u044f \u0446\u044c\u043e\u0433\u043e \u0441\u0442\u0430\u0442\u0443\u0441\u0443");

    }



    const prevFinalPriceForHistory = order.finalPrice;

    const prevBasePriceForHistory = order.price;



    const n = Number(finalPrice);

    if (!Number.isFinite(n) || n <= 0) {

      return res.status(400).send("\u0412\u043a\u0430\u0436\u0456\u0442\u044c \u043a\u043e\u0440\u0435\u043a\u0442\u043d\u0443 \u0446\u0456\u043d\u0443");

    }



    order.finalPrice = Math.round(n);

    const previousValueForHistory =

      prevFinalPriceForHistory !== null &&

      prevFinalPriceForHistory !== undefined

        ? prevFinalPriceForHistory

        : prevBasePriceForHistory;

    appendPriceHistory(

      order,

      previousValueForHistory,

      order.finalPrice,

      "finalPrice",

      "CUSTOMER",

      req.user.id

    );

    await order.save();

    broadcastOrder(order);

    res.json(order);

  } catch (err) {

    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0432\u0437\u044f\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");

  }

}





async function acceptOrder(req, res) {

  const orderId = req.params.id;

  try {

    const order = await Order.findByPk(orderId);

    if (!order || order.status !== "CREATED") {

      res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0432\u0436\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0435");



      return;

    }

    const prevFinalPriceForHistory = order.finalPrice;

    const prevBasePriceForHistory = order.price;



    // ??'? ???????-?? ?????�?� ???????,?�?????,??/???,?????????,?? ?"?-???�?�?????? ???-???? ?????? ???�???,?,?- ?????>?�???� ???????? agreedPrice === true

    if (req.body && req.body.finalPrice != null) {

      // ???�???�???-?????�: ???????-?? ?????�?� ?????,?�???????�?????�?,?? ?"?-???�?�?????? ???-???? ?,?-?�?????? ???????? ?�?�???????�?�?????? ?� ???????????-???????? ???-??????

      if (!order.agreedPrice) {

        return res.status(400).send("\u041d\u0435 \u043c\u043e\u0436\u043d\u0430 \u0432\u0438\u0441\u0442\u0430\u0432\u0438\u0442\u0438 \u0444\u0456\u043d\u0430\u043b\u044c\u043d\u0443 \u0446\u0456\u043d\u0443 \u0434\u043b\u044f \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u044c \u0456\u0437 \u0444\u0456\u043a\u0441\u043e\u0432\u0430\u043d\u043e\u044e \u0446\u0456\u043d\u043e\u044e");

      }

      const normalized = roundPriceValue(req.body.finalPrice);

      if (normalized !== null) {

        const previousValue =

          prevFinalPriceForHistory !== null &&

          prevFinalPriceForHistory !== undefined

            ? prevFinalPriceForHistory

            : prevBasePriceForHistory;

        appendPriceHistory(

          order,

          previousValue,

          normalized,

          "finalPrice",

          "DRIVER",

          req.user.id

        );

        order.finalPrice = normalized;

      }

    }



    const now = new Date();

    order.candidateDriverId = req.user.id;

    order.candidateUntil = new Date(now.getTime() + 15 * 60000);

    order.reservedBy = req.user.id;

    order.reservedUntil = order.candidateUntil;

    order.status = "PENDING";

    order.history = [

      ...(order.history || []),

      { status: "PENDING", at: new Date(), changedByRole: req.user?.role, changedById: req.user?.id },

    ];

    await order.save();

    const updated = await Order.findByPk(orderId, {

      include: { model: require("../models/user"), as: "customer" },

    });

    broadcastOrder(updated);

    if (

      updated.customer &&

      updated.customer.pushToken &&

      updated.customer.pushConsent

    ) {

      const { sendPush } = require("../utils/push");

      sendPush(

        updated.customer.pushToken,

        "\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043f\u0440\u0438\u0439\u043d\u044f\u0442\u043e",

        "\u0412\u043e\u0434\u0456\u0439 \u0432\u0437\u044f\u0432 \u0432\u0430\u0448 \u0432\u0430\u043d\u0442\u0430\u0436",

        { orderId: updated.id, navigateTo: "orderDetail" }

      );

    }

    res.json(updated);

  } catch (err) {

    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043f\u0440\u0438\u0439\u043d\u044f\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");

  }

}



async function confirmDriver(req, res) {

  const orderId = req.params.id;

  try {

    const order = await Order.findByPk(orderId);

    if (

      !order ||

      order.customerId !== req.user.id ||

      order.status !== "PENDING"

    ) {

      return res.status(400).send("\u041d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u0434\u0456\u044f \u0434\u043b\u044f \u0446\u044c\u043e\u0433\u043e \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");

    }

    const prevPriceForHistory = order.price;



    order.driverId = order.candidateDriverId;

    order.candidateDriverId = null;

    order.candidateUntil = null;

    order.reservedBy = null;

    order.reservedUntil = null;

    order.status = "ACCEPTED";

    // ???????? ???????-?? ???�?????????? ?"?-???�?�?????? ???-???? ??" ?"?-???????"???? ?-?- ???? ??????????????

    const fp = Number(order.finalPrice);

    if (Number.isFinite(fp) && fp > 0) {

      order.price = Math.round(fp);

      appendPriceHistory(

        order,

        prevPriceForHistory,

        order.price,

        "price",

        "CUSTOMER",

        req.user.id

      );

    }

    order.history = [

      ...(order.history || []),

      { status: "ACCEPTED", at: new Date(), changedByRole: req.user?.role, changedById: req.user?.id },

    ];

    await order.save();

    const updated = await Order.findByPk(orderId, {

      include: [

        { model: require("../models/user"), as: "customer" },

        { model: require("../models/user"), as: "driver" },

      ],

    });

    broadcastOrder(updated);

    const serviceFee = (order.price * SERVICE_FEE_PERCENT) / 100;

    await Transaction.create({

      orderId: order.id,

      driverId: order.driverId,

      amount: order.price,

      serviceFee,

    });

    if (

      updated.driver &&

      updated.driver.pushToken &&

      updated.driver.pushConsent

    ) {

      const { sendPush } = require("../utils/push");

      sendPush(

        updated.driver.pushToken,

        "\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043e",

        "\u0417\u0430\u043c\u043e\u0432\u043d\u0438\u043a \u043f\u0440\u0438\u0439\u043d\u044f\u0432 \u0432\u0430\u0448\u0435 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f",

        { orderId: updated.id, navigateTo: "orderDetail" }

      );

    }

    res.json(updated);

  } catch (err) {

    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0438 \u0432\u043e\u0434\u0456\u044f");

  }

}



async function rejectDriver(req, res) {

  const orderId = req.params.id;

  try {

    const order = await Order.findByPk(orderId);

    if (

      !order ||

      order.customerId !== req.user.id ||

      order.status !== "PENDING"

    ) {

      return res.status(400).send("\u041d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u0434\u0456\u044f \u0434\u043b\u044f \u0446\u044c\u043e\u0433\u043e \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");

    }

    const driver = await User.findByPk(order.candidateDriverId);

    order.candidateDriverId = null;

    order.candidateUntil = null;

    order.reservedBy = null;

    order.reservedUntil = null;

    order.status = OrderStatus.CREATED;

    order.history = [

      ...(order.history || []),

      { status: OrderStatus.REJECTED, at: new Date(), changedByRole: req.user?.role, changedById: req.user?.id },

      // { status: OrderStatus.CREATED, at: new Date() },

    ];

    await order.save();

    const updated = await Order.findByPk(orderId, {

      include: { model: require("../models/user"), as: "customer" },

    });

    broadcastOrder(updated);

    if (driver && driver.pushToken && driver.pushConsent) {

      const { sendPush } = require("../utils/push");

      sendPush(

        driver.pushToken,

        "\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0432\u0456\u0434\u0445\u0438\u043b\u0435\u043d\u043e",

        "\u0417\u0430\u043c\u043e\u0432\u043d\u0438\u043a \u0432\u0456\u0434\u0445\u0438\u043b\u0438\u0432 \u0432\u0430\u0448\u0443 \u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u044e",

        { orderId: updated.id, navigateTo: "driverOrders" }

      );

    }

    res.json(updated);

  } catch (err) {

    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0432\u0456\u0434\u0445\u0438\u043b\u0438\u0442\u0438 \u0432\u043e\u0434\u0456\u044f");

  }

}



async function updateStatus(req, res) {

  const orderId = req.params.id;

  const { status } = req.body;
  try {
    const order = await Order.findByPk(orderId);
    if (!order) {
      res.status(404).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");

      return;
    }
    if (!Object.values(OrderStatus).includes(status)) {
      return res.status(400).send("\u041d\u0435\u043a\u043e\u0440\u0435\u043a\u0442\u043d\u0438\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");
    }

    if (status === OrderStatus.COMPLETED) {
      const isCustomer = order.customerId === req.user?.id;
      const canCompleteDelivered = isCustomer && order.status === OrderStatus.DELIVERED;
      const canMoveStaleInProgress = canCustomerMoveInProgressOrderToHistory(order, req.user);
      if (!canCompleteDelivered && !canMoveStaleInProgress) {
        return res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043c\u043e\u0436\u043d\u0430 \u043f\u0435\u0440\u0435\u043c\u0456\u0441\u0442\u0438 \u0432 \u0456\u0441\u0442\u043e\u0440\u0456\u044e \u043b\u0438\u0448\u0435 \u043f\u0456\u0441\u043b\u044f \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438 \u0430\u0431\u043e \u0447\u0435\u0440\u0435\u0437 3 \u0434\u043d\u0456 \u043f\u0456\u0441\u043b\u044f \u0442\u043e\u0433\u043e, \u044f\u043a \u0432\u043e\u0434\u0456\u0439 \u043e\u0442\u0440\u0438\u043c\u0430\u0432 \u0432\u0430\u043d\u0442\u0430\u0436");
      }
    }

    order.status = status;
    const historyEntry = { status, at: new Date() };
    if (req.user?.id) {
      historyEntry.changedById = req.user.id;
    }
    if (req.user?.role) {
      historyEntry.changedByRole = req.user.role;
    }
    const uploadedFiles = [];
    if (req.file) {
      uploadedFiles.push(req.file);
    }
    if (Array.isArray(req.files)) {
      uploadedFiles.push(...req.files);
    } else if (req.files && typeof req.files === "object") {
      Object.values(req.files).forEach((group) => {
        if (Array.isArray(group)) uploadedFiles.push(...group);
      });
    }
    const photoPaths = uploadedFiles
      .map((file) => (file?.filename ? `/uploads/${file.filename}` : null))
      .filter(Boolean);
    if (photoPaths.length > 0) {
      const currentPhotos = Array.isArray(order.photos)
        ? order.photos.filter(Boolean)
        : order.photos
        ? [order.photos].filter(Boolean)
        : [];
      order.photos = [...currentPhotos, ...photoPaths];
      historyEntry.photos = photoPaths;
      // Backward-compatible field used by some existing clients/parsers.
      if (photoPaths.length === 1) {
        historyEntry.photo = photoPaths[0];
      }
      if (req.user?.id) {
        historyEntry.uploadedBy = req.user.id;
      }
    }
    const prevHistory = Array.isArray(order.history) ? order.history : [];
    order.history = [...prevHistory, historyEntry];
    await order.save();
    broadcastOrder(order);
    if (status === OrderStatus.IN_PROGRESS && order.customerId) {

      const customer = await User.findByPk(order.customerId);

      if (customer && customer.pushToken && customer.pushConsent) {

        const { sendPush } = require("../utils/push");

        sendPush(

          customer.pushToken,

          "\u0412\u043e\u0434\u0456\u0439 \u043e\u0442\u0440\u0438\u043c\u0430\u0432 \u0432\u0430\u043d\u0442\u0430\u0436",

          "\u0412\u043e\u0434\u0456\u0439 \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0432 \u043e\u0442\u0440\u0438\u043c\u0430\u043d\u043d\u044f \u0432\u0430\u043d\u0442\u0430\u0436\u0443",

          { orderId: order.id, navigateTo: "orderDetail" }

        );

      }

    }

    if (status === OrderStatus.DELIVERED && order.customerId) {

      const customer = await User.findByPk(order.customerId);

      if (customer && customer.pushToken && customer.pushConsent) {

        const { sendPush } = require("../utils/push");

        sendPush(

          customer.pushToken,

          "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0443 \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043e",

          "\u0412\u043e\u0434\u0456\u0439 \u043f\u043e\u0432\u0456\u0434\u043e\u043c\u0438\u0432 \u043f\u0440\u043e \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0443",

          { orderId: order.id, navigateTo: "orderDetail" }

        );

      }

    }

    if (status === OrderStatus.COMPLETED) {

      const tx = await Transaction.findOne({ where: { orderId: order.id } });

      if (tx && tx.status === "PENDING") {

        tx.status = "RELEASED";

        await tx.save();

        const amount = tx.amount - tx.serviceFee;

        if (order.driverId) {

          const driver = await User.findByPk(order.driverId);

          if (driver) {

            driver.balance += amount;

            await driver.save();

          }

        }

      }

    }

    res.json(order);

  } catch (err) {

    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043e\u043d\u043e\u0432\u0438\u0442\u0438 \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");

  }

}



async function updateOrder(req, res) {

  console.log(

    "RAW agreedPrice:",

    req.body?.agreedPrice,

    typeof req.body?.agreedPrice

  );



  const id = req.params.id;

  try {

    const order = await Order.findByPk(id);

    if (!order) {

      return res.status(404).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");

    }

    if (order.customerId !== req.user.id || order.status !== "CREATED") {

      return res.status(400).send("\u041d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0435 \u0440\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u043d\u043d\u044f \u0446\u044c\u043e\u0433\u043e \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");

    }

    const prevPriceForHistory = order.price;

    const prevFinalPriceForHistory = order.finalPrice;
    const getLifecycleAnchor = (entity) =>
      JSON.stringify({
        freeDate: Boolean(entity?.freeDate),
        loadFrom: entity?.loadFrom ? new Date(entity.loadFrom).toISOString() : null,
        loadTo: entity?.loadTo ? new Date(entity.loadTo).toISOString() : null,
        unloadFrom: entity?.unloadFrom ? new Date(entity.unloadFrom).toISOString() : null,
        unloadTo: entity?.unloadTo ? new Date(entity.unloadTo).toISOString() : null,
        freeDateUntil: entity?.freeDateUntil
          ? new Date(entity.freeDateUntil).toISOString()
          : null,
      });
    const previousLifecycleAnchor = getLifecycleAnchor(order);



    const fields = [

      "pickupLocation",

      "dropoffLocation",

      "pickupCountry",

      "pickupCity",

      "pickupAddress",

      "pickupPostcode",

      "dropoffCountry",

      "dropoffCity",

      "dropoffAddress",

      "dropoffPostcode",

      "cargoType",

      "cargoLength",

      "cargoWidth",

      "cargoHeight",

      "cargoVolume",

      "cargoWeight",

      "distance",

      "pickupLat",

      "pickupLon",

      "dropoffLat",

      "dropoffLon",

      "loadHelp",

      "unloadHelp",

      "freeDate",

      "requestedOrderType",

      "timingOption",

      "payment",

      "loadFrom",

      "loadTo",

      "unloadFrom",

      "unloadTo",

      "insurance",

      "price",

      "agreedPrice",

      "finalPrice",

      "freeDateUntil",

    ];



    // ?????????�?�?-?�?�???-?- ???�?? ?????�???-?�?�???????. ?,?????-??

    const normalizeNumber = (v) => {

      const n = Number(v);

      return Number.isFinite(n) ? n : null;

    };



    fields.forEach((f) => {

      if (req.body[f] !== undefined) {

        if (f === "agreedPrice") {

          order.agreedPrice = normalizeBoolean(req.body.agreedPrice);

        } else if (f === "requestedOrderType") {

          order.requestedOrderType = normalizeRequestedOrderType(req.body.requestedOrderType);

        } else if (f === "timingOption") {

          order.timingOption = normalizeTimingOption(req.body.timingOption);

        } else if (f === "freeDate") {

          order.freeDate = normalizeBoolean(req.body.freeDate);

        } else if (f === "finalPrice") {

          const n = normalizeNumber(req.body.finalPrice);

          if (n !== null) order.finalPrice = Math.round(n);

        } else if (f === "freeDateUntil") {

          const nextDate = new Date(req.body.freeDateUntil);

          if (!Number.isNaN(nextDate.getTime())) order.freeDateUntil = nextDate;

        } else if (

          [

            "cargoLength",

            "cargoWidth",

            "cargoHeight",

            "cargoVolume",

            "cargoWeight",

            "distance",

            "pickupLat",

            "pickupLon",

            "dropoffLat",

            "dropoffLon",

          ].includes(f)

        ) {

          const n = normalizeNumber(req.body[f]);

          if (n !== null) order[f] = n;

        } else {

          order[f] = req.body[f];

        }

      }

    });

    if (order.freeDate) {

      if (req.body.freeDate !== undefined) {

        const freeDateSchedule = buildFreeDateSchedule();
        order.loadFrom = freeDateSchedule.loadFrom;
        order.loadTo = freeDateSchedule.loadTo;
        order.unloadFrom = freeDateSchedule.unloadFrom;
        order.unloadTo = freeDateSchedule.unloadTo;
        order.freeDateUntil = freeDateSchedule.freeDateUntil;

      } else if (!order.freeDateUntil || Number.isNaN(new Date(order.freeDateUntil).getTime())) {

        const freeDateSchedule = buildFreeDateSchedule();
        order.loadFrom = freeDateSchedule.loadFrom;
        order.loadTo = freeDateSchedule.loadTo;
        order.unloadFrom = freeDateSchedule.unloadFrom;
        order.unloadTo = freeDateSchedule.unloadTo;
        order.freeDateUntil = freeDateSchedule.freeDateUntil;

      }

    } else {

      order.freeDateUntil = null;

    }

    if (order.requestedOrderType !== RequestedOrderType.LOCAL) {
      order.timingOption = null;
    } else if (!order.timingOption) {
      order.timingOption = TimingOption.ASAP;
    }

    order.isIntraCity = isEffectiveIntraCity(
      order.requestedOrderType,
      order.pickupCity,
      order.dropoffCity
    );



    if (req.body.price !== undefined) {

      appendPriceHistory(

        order,

        prevPriceForHistory,

        order.price,

        "price",

        "CUSTOMER",

        req.user.id

      );

    }

    if (req.body.finalPrice !== undefined) {

      const prevFinalValue =

        prevFinalPriceForHistory !== null &&

        prevFinalPriceForHistory !== undefined

          ? prevFinalPriceForHistory

          : prevPriceForHistory;

      appendPriceHistory(

        order,

        prevFinalValue,

        order.finalPrice ?? prevFinalValue,

        "finalPrice",

        "CUSTOMER",

        req.user.id

      );

    }

    console.log(req.body.agreedPrice);



    if (

      req.body.pickupLat &&

      req.body.pickupLon &&

      req.body.dropoffLat &&

      req.body.dropoffLon

    ) {

      try {

        const resRoute = await fetch(

          `https://router.project-osrm.org/route/v1/driving/${req.body.dropoffLon},${req.body.dropoffLat};${req.body.pickupLon},${req.body.pickupLat}?overview=false`

        );

        const data = await resRoute.json();

        if (data.routes && data.routes[0]) {

          const km = data.routes[0].distance / 1000;

          order.systemPrice = km * 50;

          if (order.isIntraCity) {

            order.price = 0;

          } else if (req.body.price === undefined && !order.agreedPrice) {

            order.price = order.systemPrice;

          }

        }

      } catch (err) {

        console.log(err);

      }

    }

    if (req.files && req.files.length > 0) {

      const uploaded = req.files.map((f) => `/uploads/${f.filename}`);

      order.photos = [...(order.photos || []), ...uploaded];

    }
    const nextLifecycleAnchor = getLifecycleAnchor(order);
    if (nextLifecycleAnchor !== previousLifecycleAnchor) {
      order.lifecycleRemindersSent = [];
    }

    await order.save();
    broadcastOrder(order);

    res.json(order);

  } catch (err) {

    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043e\u043d\u043e\u0432\u0438\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");

  }

}



async function deleteOrder(req, res) {

  const id = req.params.id;

  try {

    const order = await Order.findByPk(id);

    if (!order) {

      return res.status(404).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");

    }

    if (order.customerId !== req.user.id || order.status !== "CREATED") {

      return res.status(400).send("\u041d\u0435\u043c\u0430\u0454 \u043f\u0440\u0430\u0432 \u043d\u0430 \u0432\u0438\u0434\u0430\u043b\u0435\u043d\u043d\u044f");

    }

    await order.destroy();

    broadcastDelete(order.id);

    res.json({ message: "Deleted" });

  } catch (err) {

    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0432\u0438\u0434\u0430\u043b\u0438\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");

  }

}



// ?"??"? OrderResponse (new response flow) ?"??"?

const OrderResponse = require("../models/orderResponse");
const { ResponseStatus, ArrivalEta } = require("../models/orderResponse");

const MAX_ACTIVE_RESPONSES = 5;
const CONFIRM_TIMEOUT_MS = 30 * 60 * 1000;
const DISCUSSING_TIMEOUT_MS = 60 * 60 * 1000;
const OFFER_ETA_VALUES = new Set(Object.values(ArrivalEta));
const ACTIVE_RESPONSE_STATUSES = [
  ResponseStatus.RESPONDED,
  ResponseStatus.CALL_MADE,
  ResponseStatus.PENDING_CONFIRM,
  ResponseStatus.DISCUSSING,
  ResponseStatus.COUNTER_OFFERED,
];

function normalizeOfferNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveResponseFinalPrice(order, response) {
  if (!order || !response) return null;
  if (order.isIntraCity) {
    const total = roundPriceValue(response.offerTotal);
    return total && total > 0 ? total : null;
  }
  const offered = roundPriceValue(response.finalPriceOffer);
  return offered && offered > 0 ? offered : null;
}

async function rejectOtherResponses(orderId, selectedResponseId) {
  const { Op } = require("sequelize");
  await OrderResponse.update(
    { status: ResponseStatus.REJECTED },
    {
      where: {
        orderId,
        id: { [Op.ne]: selectedResponseId },
        status: { [Op.in]: ACTIVE_RESPONSE_STATUSES },
      },
    }
  );
}

async function notifyRejectedResponseDrivers(orderId, selectedResponseId, order) {
  const rejectedResponses = await OrderResponse.findAll({
    where: {
      orderId,
      status: ResponseStatus.REJECTED,
      id: { [require("sequelize").Op.ne]: selectedResponseId },
    },
  });

  for (const rr of rejectedResponses) {
    const rejDriver = await User.findByPk(rr.driverId);
    if (rejDriver?.pushToken && rejDriver.pushConsent) {
      sendPush(
        rejDriver.pushToken,
        "\u0417\u0430\u043c\u043e\u0432\u043d\u0438\u043a \u043e\u0431\u0440\u0430\u0432 \u0456\u043d\u0448\u043e\u0433\u043e \u0432\u043e\u0434\u0456\u044f",
        "\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116" + order.id,
        { orderId: order.id }
      );
    }
  }
}

async function finalizeOrderFromResponse({
  order,
  response,
  actingUserRole,
  actingUserId,
  acceptedPushTitle = "\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043e",
  acceptedPushBody = null,
}) {
  const finalPrice = resolveResponseFinalPrice(order, response);
  if (!finalPrice || finalPrice <= 0) {
    return { error: "\u041d\u0435\u043c\u0430\u0454 \u043a\u043e\u0440\u0435\u043a\u0442\u043d\u043e\u0457 \u0444\u0456\u043d\u0430\u043b\u044c\u043d\u043e\u0457 \u0446\u0456\u043d\u0438 \u0434\u043b\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043d\u044f" };
  }

  response.status = ResponseStatus.CONFIRMED;
  response.confirmedAt = new Date();
  response.expiresAt = null;
  response.customerCounterPrice = null;
  await response.save();

  const previousOrderPrice = roundPriceValue(order.price);
  order.price = finalPrice;
  order.finalPrice = finalPrice;
  appendPriceHistory(order, previousOrderPrice, finalPrice, "price", actingUserRole, actingUserId);

  order.driverId = response.driverId;
  order.status = "ACCEPTED";
  order.candidateDriverId = null;
  order.candidateUntil = null;
  order.reservedBy = null;
  order.reservedUntil = null;
  order.history = [
    ...(order.history || []),
    { status: "ACCEPTED", at: new Date(), changedByRole: actingUserRole, changedById: actingUserId },
  ];
  await order.save();

  await rejectOtherResponses(order.id, response.id);

  const driver = await User.findByPk(response.driverId);
  if (driver?.pushToken && driver.pushConsent) {
    sendPush(
      driver.pushToken,
      acceptedPushTitle,
      acceptedPushBody || ("\u0412\u0438 \u043e\u0442\u0440\u0438\u043c\u0430\u043b\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116" + order.id + ". \u041a\u043e\u043d\u0442\u0430\u043a\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043d\u0438\u043a\u0430 \u0432\u0436\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0456."),
      { orderId: order.id, navigateTo: "orderDetail" }
    );
  }

  await notifyRejectedResponseDrivers(order.id, response.id, order);

  const serviceFee = (order.price * SERVICE_FEE_PERCENT) / 100;
  await Transaction.create({ orderId: order.id, driverId: order.driverId, amount: order.price, serviceFee });

  const updated = await Order.findByPk(order.id, {
    include: [
      { model: User, as: "customer" },
      { model: User, as: "driver" },
    ],
  });
  broadcastOrder(updated);
  return { updated };
}

function canShareCustomerContacts(order, response) {
  if (!order) return false;
  if (!order.isIntraCity) return true;
  if (
    order.driverId &&
    response?.driverId === order.driverId &&
    [OrderStatus.ACCEPTED, OrderStatus.IN_PROGRESS, OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(order.status)
  ) {
    return true;
  }
  return response?.status === ResponseStatus.CONFIRMED;
}

function canShareDriverContacts(order, response) {
  if (!order) return false;
  if (!order.isIntraCity) return true;
  if (
    order.driverId &&
    response?.driverId === order.driverId &&
    [OrderStatus.ACCEPTED, OrderStatus.IN_PROGRESS, OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(order.status)
  ) {
    return true;
  }
  return response?.status === ResponseStatus.CONFIRMED;
}

async function respondToOrder(req, res) {
  const orderId = req.params.id;
  try {
    const order = await Order.findByPk(orderId, {
      include: { model: User, as: "customer" },
    });
    if (!order || order.status !== "CREATED") {
      return res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0432\u0436\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0435");
    }

    const activeCount = await OrderResponse.count({
      where: {
        driverId: req.user.id,
        status: { [require("sequelize").Op.in]: ACTIVE_RESPONSE_STATUSES },
      },
    });
    if (activeCount >= MAX_ACTIVE_RESPONSES) {
      return res.status(400).send("\u041b\u0456\u043c\u0456\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u0438\u0445 \u0432\u0456\u0434\u0433\u0443\u043a\u0456\u0432 \u0432\u0438\u0447\u0435\u0440\u043f\u0430\u043d\u043e. \u0417\u0430\u0432\u0435\u0440\u0448\u0456\u0442\u044c \u043f\u043e\u0442\u043e\u0447\u043d\u0456 \u043e\u0431\u0433\u043e\u0432\u043e\u0440\u0435\u043d\u043d\u044f \u043f\u0435\u0440\u0435\u0434 \u043d\u043e\u0432\u0438\u043c\u0438 \u0432\u0456\u0434\u0433\u0443\u043a\u0430\u043c\u0438");
    }

    const existing = await OrderResponse.findOne({
      where: { orderId, driverId: req.user.id, status: { [require("sequelize").Op.notIn]: ["DECLINED", "REJECTED", "EXPIRED"] } },
    });
    if (existing) {
      return res.status(400).send("\u0412\u0438 \u0432\u0436\u0435 \u0437\u0430\u043b\u0438\u0448\u0438\u043b\u0438 \u0432\u0456\u0434\u0433\u0443\u043a \u043d\u0430 \u0446\u0435 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f");
    }

    const isIntraCity = Boolean(order.isIntraCity);
    let hourlyRate = null;
    let minHours = null;
    let arrivalEta = null;
    let offerTotal = null;

    if (isIntraCity) {
      hourlyRate = normalizeOfferNumber(req.body?.hourlyRate);
      minHours = normalizeOfferNumber(req.body?.minHours);
      arrivalEta = req.body?.arrivalEta;

      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        return res.status(400).send("\u0412\u043a\u0430\u0436\u0456\u0442\u044c \u043a\u043e\u0440\u0435\u043a\u0442\u043d\u0443 \u0441\u0442\u0430\u0432\u043a\u0443 \u0437\u0430 \u0433\u043e\u0434\u0438\u043d\u0443");
      }
      if (!Number.isFinite(minHours) || minHours <= 0) {
        return res.status(400).send("\u0412\u043a\u0430\u0436\u0456\u0442\u044c \u043a\u043e\u0440\u0435\u043a\u0442\u043d\u0438\u0439 \u043c\u0456\u043d\u0456\u043c\u0443\u043c \u0433\u043e\u0434\u0438\u043d");
      }
      if (!OFFER_ETA_VALUES.has(arrivalEta)) {
        return res.status(400).send("\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u043a\u043e\u0440\u0435\u043a\u0442\u043d\u0438\u0439 \u0447\u0430\u0441 \u043f\u0440\u0438\u0431\u0443\u0442\u0442\u044f");
      }

      hourlyRate = roundPriceValue(hourlyRate);
      minHours = roundPriceValue(minHours);
      offerTotal = roundPriceValue(hourlyRate * minHours);
      if (!offerTotal || offerTotal <= 0) {
        return res.status(400).send("\u041d\u0435\u0432\u0430\u043b\u0456\u0434\u043d\u0430 \u0441\u0443\u043c\u0430 \u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u0457");
      }
    }
    let finalPriceOffer = null;
    if (isIntraCity) {
      finalPriceOffer = null;
    } else {
      const rawFinalPrice = req.body?.finalPrice;
      const hasExplicitFinalPrice =
        rawFinalPrice !== undefined &&
        rawFinalPrice !== null &&
        String(rawFinalPrice).trim() !== "";
      if (!hasExplicitFinalPrice) {
        return res.status(400).send("\u0412\u043a\u0430\u0436\u0456\u0442\u044c \u0444\u0456\u043d\u0430\u043b\u044c\u043d\u0443 \u0446\u0456\u043d\u0443");
      }
      const normalized = roundPriceValue(rawFinalPrice);
      if (!normalized || normalized <= 0) {
        return res.status(400).send("\u0412\u043a\u0430\u0436\u0456\u0442\u044c \u0444\u0456\u043d\u0430\u043b\u044c\u043d\u0443 \u0446\u0456\u043d\u0443");
      }
      finalPriceOffer = normalized;
    }

    const isImmediate = isIntraCity || (req.body && req.body.immediateConfirm === true);
    const initialStatus = isImmediate ? ResponseStatus.PENDING_CONFIRM : ResponseStatus.RESPONDED;

    const response = await OrderResponse.create({
      orderId,
      driverId: req.user.id,
      status: initialStatus,
      respondedAt: new Date(),
      resultSubmittedAt: isImmediate ? new Date() : null,
      hourlyRate,
      minHours,
      arrivalEta,
      offerTotal,
      finalPriceOffer,
    });

    if (order.customer && order.customer.pushToken && order.customer.pushConsent) {
      const { sendPush } = require("../utils/push");
      const driverUser = await User.findByPk(req.user.id);
      const pushTitle = isImmediate
        ? "\u0412\u043e\u0434\u0456\u0439 \u0433\u043e\u0442\u043e\u0432\u0438\u0439 \u0432\u0438\u043a\u043e\u043d\u0430\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f"
        : "\u041d\u043e\u0432\u0438\u0439 \u0432\u0456\u0434\u0433\u0443\u043a \u043d\u0430 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f";
      const pushBody = isImmediate
        ? `\u0412\u043e\u0434\u0456\u0439 ${driverUser?.name || ""} \u0445\u043e\u0447\u0435 \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116${order.id}`
        : `\u0412\u043e\u0434\u0456\u0439 ${driverUser?.name || ""} \u0437\u0430\u0446\u0456\u043a\u0430\u0432\u043b\u0435\u043d\u0438\u0439 \u0443 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u0456 \u2116${order.id}`;
      sendPush(
        order.customer.pushToken,
        isIntraCity ? "\u041d\u043e\u0432\u0430 \u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u044f \u0432\u0456\u0434 \u0432\u043e\u0434\u0456\u044f" : pushTitle,
        isIntraCity
          ? `\u0412\u043e\u0434\u0456\u0439 ${driverUser?.name || ""} \u043d\u0430\u0434\u0456\u0441\u043b\u0430\u0432 \u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u044e \u043d\u0430 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116${order.id}`
          : pushBody,
        { orderId: order.id, navigateTo: "orderDetail" }
      );
    }

    broadcastOrder(order);

    res.json({
      ...response.toJSON(),
      customerPhone: canShareCustomerContacts(order, response) ? order?.customer?.phone || null : null,
      customerName: canShareCustomerContacts(order, response) ? order?.customer?.name || null : null,
    });
  } catch (err) {
    console.error("respondToOrder error:", err);
    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0430\u043b\u0438\u0448\u0438\u0442\u0438 \u0432\u0456\u0434\u0433\u0443\u043a");
  }
}

async function getMyResponse(req, res) {
  const orderId = req.params.id;
  try {
    const response = await OrderResponse.findOne({
      where: {
        orderId,
        driverId: req.user.id,
        status: { [require("sequelize").Op.notIn]: ["DECLINED", "REJECTED", "EXPIRED"] },
      },
      order: [["updatedAt", "DESC"], ["id", "DESC"]],
    });
    if (!response) return res.status(404).send("\u041d\u0435\u043c\u0430\u0454 \u0432\u0456\u0434\u0433\u0443\u043a\u0443");

    const order = await Order.findByPk(orderId, {
      include: { model: User, as: "customer" },
    });

    res.json({
      ...response.toJSON(),
      customerPhone: canShareCustomerContacts(order, response) ? order?.customer?.phone || null : null,
      customerName: canShareCustomerContacts(order, response) ? order?.customer?.name || null : null,
    });
  } catch (err) {
    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043e\u0442\u0440\u0438\u043c\u0430\u0442\u0438 \u0432\u0456\u0434\u0433\u0443\u043a");
  }
}

async function responseCallMade(req, res) {
  const { id: orderId, responseId } = req.params;
  try {
    const orderPrimary = await Order.findByPk(orderId, { include: { model: User, as: "customer" } });
    let order = orderPrimary;
    if (!order) return res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");
    if (order.isIntraCity) return res.status(400).send("\u0414\u043b\u044f \u043c\u0456\u0441\u044c\u043a\u0438\u0445 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u044c \u0434\u0437\u0432\u0456\u043d\u043e\u043a \u043d\u0435 \u043f\u043e\u0442\u0440\u0456\u0431\u0435\u043d");

    order = await Order.findByPk(orderId, { include: { model: User, as: "customer" } });
    if (!order) return res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");
    if (order.isIntraCity) return res.status(400).send("\u0414\u043b\u044f \u043c\u0456\u0441\u044c\u043a\u0438\u0445 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u044c \u0435\u0442\u0430\u043f \u0434\u0437\u0432\u0456\u043d\u043a\u0430 \u043d\u0435 \u043f\u043e\u0442\u0440\u0456\u0431\u0435\u043d");

    const response = await OrderResponse.findByPk(responseId);
    if (!response || response.orderId !== parseInt(orderId) || response.driverId !== req.user.id) {
      return res.status(400).send("\u0412\u0456\u0434\u0433\u0443\u043a \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");
    }
    response.status = ResponseStatus.CALL_MADE;
    response.callMadeAt = new Date();
    await response.save();

    res.json({
      ...response.toJSON(),
      customerPhone: canShareCustomerContacts(order, response) ? order?.customer?.phone || null : null,
      customerName: canShareCustomerContacts(order, response) ? order?.customer?.name || null : null,
    });
  } catch (err) {
    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043f\u043e\u0437\u043d\u0430\u0447\u0438\u0442\u0438 \u0434\u0437\u0432\u0456\u043d\u043e\u043a");
  }
}

async function responseResult(req, res) {
  const { id: orderId, responseId } = req.params;
  const { result } = req.body;
  try {
    const order = await Order.findByPk(orderId, { include: { model: User, as: "customer" } });
    if (!order) return res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");
    if (order.isIntraCity) return res.status(400).send("\u0414\u043b\u044f \u043c\u0456\u0441\u044c\u043a\u0438\u0445 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u044c \u0435\u0442\u0430\u043f \u0434\u0437\u0432\u0456\u043d\u043a\u0430 \u043d\u0435 \u043f\u043e\u0442\u0440\u0456\u0431\u0435\u043d");

    const response = await OrderResponse.findByPk(responseId);
    if (!response || response.orderId !== parseInt(orderId) || response.driverId !== req.user.id) {
      return res.status(400).send("\u0412\u0456\u0434\u0433\u0443\u043a \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");
    }

    if (result === "agreed") {
      response.status = ResponseStatus.PENDING_CONFIRM;
      response.resultSubmittedAt = new Date();
      response.expiresAt = new Date(Date.now() + CONFIRM_TIMEOUT_MS);
      await response.save();

      if (order?.customer?.pushToken && order.customer.pushConsent) {
        const { sendPush } = require("../utils/push");
        const driverUser = await User.findByPk(req.user.id);
        sendPush(
          order.customer.pushToken,
          "\u0412\u043e\u0434\u0456\u0439 \u0433\u043e\u0442\u043e\u0432\u0438\u0439 \u0432\u0438\u043a\u043e\u043d\u0430\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f",
          `\u0412\u043e\u0434\u0456\u0439 ${driverUser?.name || ""} \u0433\u043e\u0442\u043e\u0432\u0438\u0439 \u0432\u0438\u043a\u043e\u043d\u0430\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116${order.id}. \u041f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0456\u0442\u044c.`,
          { orderId: order.id, navigateTo: "orderDetail" }
        );
      }
    } else if (result === "discussing") {
      response.status = ResponseStatus.DISCUSSING;
      response.resultSubmittedAt = new Date();
      response.expiresAt = new Date(Date.now() + DISCUSSING_TIMEOUT_MS);
      await response.save();
    } else if (result === "declined") {
      response.status = ResponseStatus.DECLINED;
      response.resultSubmittedAt = new Date();
      await response.save();
    } else {
      return res.status(400).send("\u041d\u0435\u0432\u0456\u0434\u043e\u043c\u0438\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u0434\u0437\u0432\u0456\u043d\u043a\u0430");
    }

    broadcastOrder(order);
    res.json({
      ...response.toJSON(),
      customerPhone: canShareCustomerContacts(order, response) ? order?.customer?.phone || null : null,
      customerName: canShareCustomerContacts(order, response) ? order?.customer?.name || null : null,
    });
  } catch (err) {
    console.error("responseResult error:", err);
    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0431\u0435\u0440\u0435\u0433\u0442\u0438 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u0434\u0437\u0432\u0456\u043d\u043a\u0430");
  }
}

async function responseConfirm(req, res) {
  const { id: orderId, responseId } = req.params;
  try {
    const response = await OrderResponse.findByPk(responseId);
    if (!response || response.orderId !== parseInt(orderId) || response.status !== ResponseStatus.PENDING_CONFIRM) {
      return res.status(400).send("\u0412\u0456\u0434\u0433\u0443\u043a \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0438\u0439 \u0434\u043b\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043d\u044f");
    }

    const order = await Order.findByPk(orderId);
    if (!order || order.customerId !== req.user.id) {
      return res.status(400).send("\u041d\u0435\u043c\u0430\u0454 \u043f\u0440\u0430\u0432");
    }
    if (order.status !== "CREATED") {
      return res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0432\u0436\u0435 \u043d\u0435 \u0441\u0442\u0432\u043e\u0440\u0435\u043d\u0435");
    }

    response.status = ResponseStatus.CONFIRMED;
    response.confirmedAt = new Date();
    response.expiresAt = null;
    await response.save();

    const previousOrderPrice = roundPriceValue(order.price);
    if (order.isIntraCity) {
      const total = roundPriceValue(response.offerTotal);
      if (!total || total <= 0) {
        return res.status(400).send("\u041d\u0435\u043c\u0430\u0454 \u043a\u043e\u0440\u0435\u043a\u0442\u043d\u043e\u0457 \u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u0457 \u0434\u043b\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043d\u044f");
      }
      order.price = total;
      order.finalPrice = total;
      appendPriceHistory(order, previousOrderPrice, total, "price", "CUSTOMER", req.user.id);
    }

    order.driverId = response.driverId;
    order.status = "ACCEPTED";
    order.history = [...(order.history || []), { status: "ACCEPTED", at: new Date(), changedByRole: req.user?.role, changedById: req.user?.id }];
    await order.save();

    const { Op } = require("sequelize");
    await OrderResponse.update(
      { status: ResponseStatus.REJECTED },
      {
        where: {
          orderId,
          id: { [Op.ne]: response.id },
          status: { [Op.in]: ACTIVE_RESPONSE_STATUSES },
        },
      }
    );

    const driver = await User.findByPk(response.driverId);
    if (driver?.pushToken && driver.pushConsent) {
      const { sendPush } = require("../utils/push");
      sendPush(
        driver.pushToken,
        "\u0417\u0430\u043c\u043e\u0432\u043d\u0438\u043a \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0432!",
        `\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116${order.id} \u0437\u0430 \u0432\u0430\u043c\u0438.`,
        { orderId: order.id, navigateTo: "orderDetail" }
      );
    }

    const rejectedResponses = await OrderResponse.findAll({
      where: { orderId, status: ResponseStatus.REJECTED, id: { [require("sequelize").Op.ne]: response.id } },
    });
    for (const rr of rejectedResponses) {
      const rejDriver = await User.findByPk(rr.driverId);
      if (rejDriver?.pushToken && rejDriver.pushConsent) {
        const { sendPush } = require("../utils/push");
        sendPush(rejDriver.pushToken, "\u0417\u0430\u043c\u043e\u0432\u043d\u0438\u043a \u043e\u0431\u0440\u0430\u0432 \u0456\u043d\u0448\u043e\u0433\u043e \u0432\u043e\u0434\u0456\u044f", `\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116${order.id}`, { orderId: order.id });
      }
    }

    const serviceFee = (order.price * SERVICE_FEE_PERCENT) / 100;
    await Transaction.create({ orderId: order.id, driverId: order.driverId, amount: order.price, serviceFee });

    const updated = await Order.findByPk(orderId, {
      include: [
        { model: User, as: "customer" },
        { model: User, as: "driver" },
      ],
    });
    broadcastOrder(updated);
    res.json(updated);
  } catch (err) {
    console.error("responseConfirm error:", err);
    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0438 \u0432\u0456\u0434\u0433\u0443\u043a");
  }
}

async function responseConfirmCityAware(req, res) {
  const { id: orderId, responseId } = req.params;
  try {
    const response = await OrderResponse.findByPk(responseId);
    if (!response || response.orderId !== parseInt(orderId) || !ACTIVE_RESPONSE_STATUSES.includes(response.status)) {
      return res.status(400).send("\u0412\u0456\u0434\u0433\u0443\u043a \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0438\u0439 \u0434\u043b\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043d\u044f");
    }

    const order = await Order.findByPk(orderId);
    if (!order || order.customerId !== req.user.id) {
      return res.status(400).send("\u041d\u0435\u043c\u0430\u0454 \u043f\u0440\u0430\u0432");
    }
    if (order.status !== "CREATED") {
      return res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0432\u0436\u0435 \u043d\u0435 \u0441\u0442\u0432\u043e\u0440\u0435\u043d\u0435");
    }

    const result = await finalizeOrderFromResponse({
      order,
      response,
      actingUserRole: "CUSTOMER",
      actingUserId: req.user.id,
      acceptedPushTitle: "\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043e",
      acceptedPushBody: "\u0412\u0438 \u043e\u0442\u0440\u0438\u043c\u0430\u043b\u0438 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116" + order.id + ". \u041a\u043e\u043d\u0442\u0430\u043a\u0442\u0438 \u0437\u0430\u043c\u043e\u0432\u043d\u0438\u043a\u0430 \u0432\u0436\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0456.",
    });

    if (result.error) {
      return res.status(400).send(result.error);
    }

    return res.json(result.updated);
  } catch (err) {
    console.error("responseConfirm error:", err);
    return res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0438 \u0432\u0456\u0434\u0433\u0443\u043a");
  }
}

async function customerCounterOffer(req, res) {
  const { id: orderId, responseId } = req.params;
  const normalized = roundPriceValue(req.body?.finalPrice);
  if (!normalized || normalized <= 0) {
    return res.status(400).send("\u0412\u043a\u0430\u0436\u0456\u0442\u044c \u043a\u043e\u0440\u0435\u043a\u0442\u043d\u0443 \u0444\u0456\u043d\u0430\u043b\u044c\u043d\u0443 \u0446\u0456\u043d\u0443");
  }

  try {
    const order = await Order.findByPk(orderId);
    if (!order) return res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");
    if (order.status !== "CREATED") {
      return res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0432\u0436\u0435 \u043d\u0435 \u0441\u0442\u0432\u043e\u0440\u0435\u043d\u0435");
    }
    if (order.isIntraCity) {
      return res.status(400).send("\u041a\u043e\u043d\u0442\u0440\u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u0434\u043b\u044f \u043c\u0456\u0441\u044c\u043a\u0438\u0445 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u044c");
    }

    const response = await OrderResponse.findByPk(responseId);
    if (!response || response.orderId !== parseInt(orderId) || !ACTIVE_RESPONSE_STATUSES.includes(response.status)) {
      return res.status(400).send("\u0412\u0456\u0434\u0433\u0443\u043a \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0438\u0439 \u0434\u043b\u044f \u043a\u043e\u043d\u0442\u0440\u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u0457");
    }

    if (req.user.role === "CUSTOMER") {
      if (order.customerId !== req.user.id) {
        return res.status(400).send("\u041d\u0435\u043c\u0430\u0454 \u043f\u0440\u0430\u0432");
      }

      response.status = ResponseStatus.COUNTER_OFFERED;
      response.customerCounterPrice = normalized;
      response.expiresAt = new Date(Date.now() + DISCUSSING_TIMEOUT_MS);
      response.resultSubmittedAt = new Date();
      await response.save();

      const driver = await User.findByPk(response.driverId);
      if (driver?.pushToken && driver.pushConsent) {
        sendPush(
          driver.pushToken,
          "\u0417\u0430\u043c\u043e\u0432\u043d\u0438\u043a \u043f\u0440\u043e\u043f\u043e\u043d\u0443\u0454 \u0456\u043d\u0448\u0443 \u0446\u0456\u043d\u0443",
          "\u0417\u0430\u043c\u043e\u0432\u043d\u0438\u043a \u043f\u0440\u043e\u043f\u043e\u043d\u0443\u0454 " + normalized + " \u0433\u0440\u043d \u0437\u0430 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116" + order.id,
          { orderId: order.id, navigateTo: "orderDetail" }
        );
      }

      broadcastOrder(order);
      return res.json(response);
    }

    if (req.user.role === "DRIVER") {
      if (response.driverId !== req.user.id) {
        return res.status(400).send("\u041d\u0435\u043c\u0430\u0454 \u043f\u0440\u0430\u0432");
      }

      response.status = ResponseStatus.DISCUSSING;
      response.finalPriceOffer = normalized;
      response.customerCounterPrice = null;
      response.expiresAt = new Date(Date.now() + DISCUSSING_TIMEOUT_MS);
      response.resultSubmittedAt = new Date();
      await response.save();

      const customer = await User.findByPk(order.customerId);
      if (customer?.pushToken && customer.pushConsent) {
        sendPush(
          customer.pushToken,
          "\u0412\u043e\u0434\u0456\u0439 \u043f\u0440\u043e\u043f\u043e\u043d\u0443\u0454 \u0456\u043d\u0448\u0443 \u0446\u0456\u043d\u0443",
          "\u0412\u043e\u0434\u0456\u0439 \u043f\u0440\u043e\u043f\u043e\u043d\u0443\u0454 " + normalized + " \u0433\u0440\u043d \u0437\u0430 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116" + order.id,
          { orderId: order.id, navigateTo: "orderDetail" }
        );
      }

      broadcastOrder(order);
      return res.json(response);
    }

    return res.status(400).send("\u041d\u0435\u043c\u0430\u0454 \u043f\u0440\u0430\u0432");
  } catch (err) {
    console.error("customerCounterOffer error:", err);
    return res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043d\u0430\u0434\u0456\u0441\u043b\u0430\u0442\u0438 \u043a\u043e\u043d\u0442\u0440\u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u044e");
  }
}

async function responseCounterDecision(req, res) {
  const { id: orderId, responseId } = req.params;
  const decision = String(req.body?.decision || "").toLowerCase();
  if (!["accept", "reject"].includes(decision)) {
    return res.status(400).send("\u041d\u0435\u0432\u0456\u0434\u043e\u043c\u0435 \u0440\u0456\u0448\u0435\u043d\u043d\u044f");
  }

  try {
    const response = await OrderResponse.findByPk(responseId);
    if (
      !response ||
      response.orderId !== parseInt(orderId) ||
      response.driverId !== req.user.id ||
      response.status !== ResponseStatus.COUNTER_OFFERED
    ) {
      return res.status(400).send("\u041a\u043e\u043d\u0442\u0440\u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430");
    }

    const order = await Order.findByPk(orderId, { include: [{ model: User, as: "customer" }] });
    if (!order || order.status !== "CREATED") {
      return res.status(400).send("\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0432\u0436\u0435 \u043d\u0435 \u0441\u0442\u0432\u043e\u0440\u0435\u043d\u0435");
    }
    if (order.isIntraCity) {
      return res.status(400).send("\u041a\u043e\u043d\u0442\u0440\u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u0434\u043b\u044f \u043c\u0456\u0441\u044c\u043a\u0438\u0445 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u044c");
    }

    if (decision === "reject") {
      response.status = ResponseStatus.DECLINED;
      response.resultSubmittedAt = new Date();
      response.expiresAt = null;
      response.customerCounterPrice = null;
      await response.save();

      if (order.customer?.pushToken && order.customer.pushConsent) {
        sendPush(
          order.customer.pushToken,
          "\u0412\u043e\u0434\u0456\u0439 \u0432\u0456\u0434\u0445\u0438\u043b\u0438\u0432 \u0432\u0430\u0448\u0443 \u043a\u043e\u043d\u0442\u0440\u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u044e",
          "\u0412\u043e\u0434\u0456\u0439 \u0432\u0456\u0434\u0445\u0438\u043b\u0438\u0432 \u0432\u0430\u0448\u0443 \u043a\u043e\u043d\u0442\u0440\u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u044e \u0434\u043b\u044f \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116" + order.id,
          { orderId: order.id, navigateTo: "orderDetail" }
        );
      }

      broadcastOrder(order);
      return res.json(response);
    }

    const counterPrice = roundPriceValue(response.customerCounterPrice);
    if (!counterPrice || counterPrice <= 0) {
      return res.status(400).send("\u041d\u0435\u043c\u0430\u0454 \u043a\u043e\u0440\u0435\u043a\u0442\u043d\u043e\u0457 \u0446\u0456\u043d\u0438 \u043a\u043e\u043d\u0442\u0440\u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u0457");
    }

    response.finalPriceOffer = counterPrice;

    const result = await finalizeOrderFromResponse({
      order,
      response,
      actingUserRole: "DRIVER",
      actingUserId: req.user.id,
      acceptedPushTitle: "\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043e",
      acceptedPushBody: "\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116" + order.id + " \u0437\u0430\u043a\u0440\u0456\u043f\u043b\u0435\u043d\u043e \u0437\u0430 \u0432\u0430\u043c\u0438.",
    });

    if (result.error) {
      return res.status(400).send(result.error);
    }

    if (order.customer?.pushToken && order.customer.pushConsent) {
      sendPush(
        order.customer.pushToken,
        "\u0412\u043e\u0434\u0456\u0439 \u043f\u043e\u0433\u043e\u0434\u0438\u0432\u0441\u044f \u043d\u0430 \u0432\u0430\u0448\u0443 \u0446\u0456\u043d\u0443",
        "\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116" + order.id + " \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043e \u0437\u0430 \u0446\u0456\u043d\u043e\u044e " + counterPrice + " \u0433\u0440\u043d.",
        { orderId: order.id, navigateTo: "orderDetail" }
      );
    }

    return res.json(result.updated);
  } catch (err) {
    console.error("responseCounterDecision error:", err);
    return res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043e\u0431\u0440\u043e\u0431\u0438\u0442\u0438 \u0440\u0456\u0448\u0435\u043d\u043d\u044f \u043f\u043e \u043a\u043e\u043d\u0442\u0440\u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u0457");
  }
}

async function responseReject(req, res) {
  const { id: orderId, responseId } = req.params;
  try {
    const response = await OrderResponse.findByPk(responseId);
    if (!response || response.orderId !== parseInt(orderId)) {
      return res.status(400).send("\u0412\u0456\u0434\u0433\u0443\u043a \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");
    }
    const order = await Order.findByPk(orderId);
    if (!order || order.customerId !== req.user.id) {
      return res.status(400).send("\u041d\u0435\u043c\u0430\u0454 \u043f\u0440\u0430\u0432");
    }

    response.status = ResponseStatus.REJECTED;
    await response.save();

    const driver = await User.findByPk(response.driverId);
    if (driver?.pushToken && driver.pushConsent) {
      const { sendPush } = require("../utils/push");
      sendPush(driver.pushToken, "\u0417\u0430\u043c\u043e\u0432\u043d\u0438\u043a \u0432\u0456\u0434\u0445\u0438\u043b\u0438\u0432 \u0432\u0430\u0448\u0443 \u043f\u0440\u043e\u043f\u043e\u0437\u0438\u0446\u0456\u044e", `\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2116${order.id}`, { orderId: order.id });
    }

    broadcastOrder(order);
    res.json(response);
  } catch (err) {
    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0432\u0456\u0434\u0445\u0438\u043b\u0438\u0442\u0438 \u0432\u0456\u0434\u0433\u0443\u043a");
  }
}

async function responseWithdraw(req, res) {
  const { id: orderId, responseId } = req.params;
  try {
    const response = await OrderResponse.findByPk(responseId);
    if (!response || response.orderId !== parseInt(orderId) || response.driverId !== req.user.id) {
      return res.status(400).send("\u0412\u0456\u0434\u0433\u0443\u043a \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e");
    }
    response.status = ResponseStatus.DECLINED;
    await response.save();
    res.json({ message: "\u0412\u0456\u0434\u0433\u0443\u043a \u0432\u0456\u0434\u043a\u043b\u0438\u043a\u0430\u043d\u043e" });
  } catch (err) {
    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0432\u0456\u0434\u043a\u043b\u0438\u043a\u0430\u0442\u0438 \u0432\u0456\u0434\u0433\u0443\u043a");
  }
}

async function getOrderResponses(req, res) {
  const orderId = req.params.id;
  try {
    const order = await Order.findByPk(orderId);
    if (!order || order.customerId !== req.user.id) {
      return res.status(400).send("\u041d\u0435\u043c\u0430\u0454 \u043f\u0440\u0430\u0432");
    }
    const responses = await OrderResponse.findAll({
      where: { orderId },
      include: [{ model: User, as: "driver", include: [{ model: DriverProfile, as: "driverProfile" }] }],
      order: [["respondedAt", "DESC"]],
    });
    const driverIds = responses.map((r) => r.driver?.id).filter(Boolean);
    const [driverRatings, driverCompletedOrders] = await Promise.all([
      getRoleRatings(driverIds, "DRIVER"),
      getCompletedOrderCounts(driverIds, "DRIVER"),
    ]);
    const result = responses.map((r) => {
      const json = r.toJSON();
      const driverRating = r.driver?.id ? driverRatings[r.driver.id] : null;
      const driverCompletedOrderCount = r.driver?.id ? driverCompletedOrders[r.driver.id] ?? 0 : 0;
      if (json.driver && driverRating != null) {
        json.driver.rating = driverRating;
        json.driver.completedOrders = driverCompletedOrderCount;
      }
      return {
        ...json,
        driverName: r.driver?.name || null,
        driverPhone: canShareDriverContacts(order, r) ? r.driver?.phone || null : null,
        driverRating,
        driverCompletedOrders: driverCompletedOrderCount,
      };
    });
    res.json(result);
  } catch (err) {
    res.status(400).send("\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043e\u0442\u0440\u0438\u043c\u0430\u0442\u0438 \u0432\u0456\u0434\u0433\u0443\u043a\u0438");
  }
}

module.exports = {
  createOrder,
  listAvailableOrders,
  reserveOrder,
  cancelReserve,
  acceptOrder,
  confirmDriver,
  rejectDriver,
  updateStatus,
  listMyOrders,
  getOrder,
  updateOrder,
  deleteOrder,
  updateFinalPrice,
  respondToOrder,
  getMyResponse,
  responseCallMade,
  responseResult,
  responseConfirm: responseConfirmCityAware,
  customerCounterOffer,
  responseCounterDecision,
  responseReject,
  responseWithdraw,
  getOrderResponses,
};
