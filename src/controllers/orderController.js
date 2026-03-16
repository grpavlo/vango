const Order = require("../models/order");

const { OrderStatus } = require("../models/order");

const Transaction = require("../models/transaction");

const User = require("../models/user");

const DriverProfile = require("../models/driverProfile");
const SavedSearch = require("../models/savedSearch");

const { SERVICE_FEE_PERCENT } = require("../config");

const { broadcastOrder, broadcastDelete } = require("../ws");
const { sendPush } = require("../utils/push");



const PRICE_HISTORY_STATUS = "PRICE_UPDATED";



const roundPriceValue = (value) => {

  if (value === null || value === undefined) return null;

  const num = Number(value);

  return Number.isFinite(num) ? Math.round(num) : null;

};



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

// Будуємо діапазон дат у UTC за текстовим параметром `date` (DD.MM або DD.MM.YYYY),
// щоб фільтр не залежав від локального часового поясу сервера.
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

// Діапазон з dateFrom по dateTo (DD.MM або DD.MM.YYYY).
// Повертає { start, end } для фільтра loadFrom.
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
      "Нове замовлення за вашим критерієм",
      `${order.pickupCity || "Місто завантаження"} • ${Math.round(
        Number(savedSearch.radius)
      )} км`,
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

    payment,

    agreedPrice,

    insurance,

  } = req.body;

  let systemPrice = 0;

  let price = 0;

  try {

    if (pickupLat && pickupLon && dropoffLat && dropoffLon) {

      const resRoute = await fetch(

        `https://router.project-osrm.org/route/v1/driving/${pickupLon},${pickupLat};${dropoffLon},${dropoffLat}?overview=false`

      );

      const data = await resRoute.json();

      if (data.routes && data.routes[0]) {

        const km = data.routes[0].distance / 1000;

        systemPrice = km * 50;

        price = parseFloat(req.body.price || systemPrice);

      }

    }

    const { cargoLength, cargoWidth, cargoHeight, cargoVolume, cargoWeight, distance } = req.body;

    const order = await Order.create({

      customerId: req.user.id,

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

      pickupLat,

      pickupLon,

      dropoffLat,

      dropoffLon,

      loadHelp: loadHelp === "true" || loadHelp === true,

      unloadHelp: unloadHelp === "true" || unloadHelp === true,

      payment,

      loadFrom,

      loadTo,

      unloadFrom,

      unloadTo,

      insurance,

      systemPrice,

      price,

      agreedPrice: agreedPrice === "true" || agreedPrice === true,

      distance: distance ? parseFloat(distance) : null,

      cargoLength: cargoLength ? parseFloat(cargoLength) : null,

      cargoWidth: cargoWidth ? parseFloat(cargoWidth) : null,

      cargoHeight: cargoHeight ? parseFloat(cargoHeight) : null,

      cargoVolume: cargoVolume ? parseFloat(cargoVolume) : null,

      cargoWeight: cargoWeight ? parseFloat(cargoWeight) : null,

      photos: req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [],

      history: [{ status: "CREATED", at: new Date() }],

    });

    broadcastOrder(order);
    await notifyDriversAboutSavedSearchMatch(order);
    res.json(order);

  } catch (err) {

    res.status(400).send("Не вдалося створити замовлення");

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

  if (dateFrom && dateTo) {
    const range = buildUtcDateRange(dateFrom, dateTo);
    if (range) {
      where.loadFrom = { [Op.gte]: range.start, [Op.lt]: range.end };
    }
  } else if (date) {
    const range = buildUtcDayRange(date);
    if (range) {
      where.loadFrom = { [Op.gte]: range.start };
      where.loadTo = { [Op.lt]: range.end };
    }
  } else {
    // Якщо дата не передана, показуємо тільки майбутні замовлення
    andConditions.push({ loadFrom: { [Op.gte]: now } });
  }

  where[Op.and] = andConditions;

  const orders = await Order.findAll({ where });



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

  const OrderResponse = require("../models/orderResponse");
  const { Op: SeqOp } = require("sequelize");
  const orderIds = filtered.map((o) => o.id);
  let responseCounts = {};
  if (orderIds.length > 0) {
    const counts = await OrderResponse.findAll({
      attributes: ["orderId", [require("sequelize").fn("COUNT", require("sequelize").col("id")), "cnt"]],
      where: { orderId: { [SeqOp.in]: orderIds }, status: { [SeqOp.in]: ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING"] } },
      group: ["orderId"],
      raw: true,
    });
    counts.forEach((c) => { responseCounts[c.orderId] = parseInt(c.cnt); });
  }
  const enriched = filtered.map((o) => {
    const json = o.toJSON ? o.toJSON() : o;
    json.responseCount = responseCounts[json.id] || 0;
    return json;
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
        status: { [SeqOp.in]: ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING"] },
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
      where: { orderId: { [SeqOp.in]: myOrderIds }, status: { [SeqOp.in]: ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING"] } },
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
          status: { [SeqOp.in]: ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING", "CONFIRMED"] },
        },
        raw: true,
      });
      myResps.forEach((r) => { myResponseStatuses[r.orderId] = r.status; });
    }
  }

  const enrichedOrders = orders.map((o) => {
    const json = o.toJSON();
    json.responseCount = myResponseCounts[json.id] || 0;
    json.myResponseStatus = myResponseStatuses[json.id] || null;
    return json;
  });

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

      return res.status(404).send("Замовлення не знайдено");

    }

    const responseCount = await OrderResponse.count({
      where: {
        orderId: id,
        status: { [require("sequelize").Op.in]: ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING"] },
      },
    });

    const json = order.toJSON();
    json.responseCount = responseCount;
    res.json(json);

  } catch (err) {

    res.status(400).send("Не вдалося отримати замовлення");

  }

}



async function reserveOrder(req, res) {

  const orderId = req.params.id;

  try {

    const order = await Order.findByPk(orderId, {

      include: { model: require("../models/user"), as: "customer" },

    });

    if (!order || order.status !== "CREATED") {

      return res.status(400).send("Замовлення недоступне");

    }

    const prevFinalPriceForHistory = order.finalPrice;

    const prevBasePriceForHistory = order.price;



    // 👇 водій може запропонувати фінальну ціну під час резерву ТІЛЬКИ якщо agreedPrice === true

    if (req.body && req.body.finalPrice != null) {

      // Перевірка: водій може встановлювати фінальну ціну тільки якщо замовлення з договірною ціною

      if (!order.agreedPrice) {

        return res.status(400).send("Не можна встановлювати фінальну ціну для замовлення без договірної ціни");

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

      return res.status(400).send("Вже зарезервовано");

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

        "Замовлення у резерві",

        "Водій взяв ваше замовлення в резерв",

        { orderId: order.id, navigateTo: "orderDetail" }

      );

    }

    res.json({

      order,

      phone: order.customer ? order.customer.phone : null,

      name: order.customer ? order.customer.name : null,

    });

  } catch (err) {

    res.status(400).send("Не вдалося зарезервувати");

  }

}



async function cancelReserve(req, res) {

  const orderId = req.params.id;



  try {

    const order = await Order.findByPk(orderId);



    // 1️⃣ Перевірка прав доступу

    if (

      !order ||

      (order.reservedBy !== req.user.id && order.customerId !== req.user.id)

    ) {

      return res.status(400).send("Немає резерву або немає прав");

    }



    const prevStatus = order.status;



    // 2️⃣ Очистка полів резерву

    order.reservedBy = null;

    order.reservedUntil = null;

    order.candidateDriverId = null;

    order.candidateUntil = null;



    // Якщо водій уже був прив’язаний, знімаємо і його

    if (order.driverId && order.status === "RESERVED") {

      order.driverId = null;

    }



    // 3️⃣ Оновлюємо статус лише якщо він був інший

    if (prevStatus !== "CREATED") {

      order.status = "CREATED";

      order.history = [

        ...(order.history || []),

        { status: "CREATED", at: new Date(), note: "Резерв скасовано" },

      ];

    }



    await order.save();



    // 4️⃣ Завантажуємо оновлений об’єкт з усіма зв’язками

    const updated = await Order.findByPk(orderId, {

      include: [{ model: require("../models/user"), as: "customer" }],

    });



    // 5️⃣ Сповіщаємо фронт про оновлення

    broadcastOrder(updated);



    res.json(updated);

  } catch (err) {

    console.error("❌ cancelReserve error:", err);

    res.status(400).send("Не вдалося зняти резерв");

  }

}



async function updateFinalPrice(req, res) {

  const orderId = req.params.id;

  const { finalPrice } = req.body;



  try {

    const order = await Order.findByPk(orderId);

    if (!order) return res.status(404).send("Замовлення не знайдено");



    // 👇 Лише замовник може змінювати ціну, поки не підтвердив водія

    if (order.customerId !== req.user.id || !["CREATED", "PENDING"].includes(order.status)) {

      return res.status(400).send("Не можна редагувати фінальну ціну на цьому етапі");

    }



    const prevFinalPriceForHistory = order.finalPrice;

    const prevBasePriceForHistory = order.price;



    const n = Number(finalPrice);

    if (!Number.isFinite(n) || n <= 0) {

      return res.status(400).send("Некоректна сума");

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

    res.status(400).send("Не вдалося змінити фінальну ціну");

  }

}





async function acceptOrder(req, res) {

  const orderId = req.params.id;

  try {

    const order = await Order.findByPk(orderId);

    if (!order || order.status !== "CREATED") {

      res.status(400).send("Замовлення недоступне");



      return;

    }

    const prevFinalPriceForHistory = order.finalPrice;

    const prevBasePriceForHistory = order.price;



    // 👇 водій може виставити/уточнити фінальну ціну при взятті ТІЛЬКИ якщо agreedPrice === true

    if (req.body && req.body.finalPrice != null) {

      // Перевірка: водій може встановлювати фінальну ціну тільки якщо замовлення з договірною ціною

      if (!order.agreedPrice) {

        return res.status(400).send("Не можна встановлювати фінальну ціну для замовлення без договірної ціни");

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

      { status: "PENDING", at: new Date() },

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

        "Замовлення прийнято",

        "Водій взяв ваш вантаж",

        { orderId: updated.id, navigateTo: "orderDetail" }

      );

    }

    res.json(updated);

  } catch (err) {

    res.status(400).send("Не вдалося прийняти замовлення");

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

      return res.status(400).send("Неможливо підтвердити");

    }

    const prevPriceForHistory = order.price;



    order.driverId = order.candidateDriverId;

    order.candidateDriverId = null;

    order.candidateUntil = null;

    order.reservedBy = null;

    order.reservedUntil = null;

    order.status = "ACCEPTED";

    // Якщо водій узгодив фінальну ціну — фіксуємо її як основну

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

      { status: "ACCEPTED", at: new Date() },

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

        "Замовлення підтверджено",

        "Замовник прийняв ваше замовлення",

        { orderId: updated.id, navigateTo: "orderDetail" }

      );

    }

    res.json(updated);

  } catch (err) {

    res.status(400).send("Не вдалося підтвердити водія");

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

      return res.status(400).send("Неможливо відхилити");

    }

    const driver = await User.findByPk(order.candidateDriverId);

    order.candidateDriverId = null;

    order.candidateUntil = null;

    order.reservedBy = null;

    order.reservedUntil = null;

    order.status = OrderStatus.CREATED;

    order.history = [

      ...(order.history || []),

      { status: OrderStatus.REJECTED, at: new Date() },

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

        "Замовлення відхилено",

        "Замовник відхилив ваш пропозицію",

        { orderId: updated.id, navigateTo: "driverOrders" }

      );

    }

    res.json(updated);

  } catch (err) {

    res.status(400).send("Не вдалося відхилити водія");

  }

}



async function updateStatus(req, res) {

  const orderId = req.params.id;

  const { status } = req.body;
  try {
    const order = await Order.findByPk(orderId);
    if (!order) {
      res.status(404).send("Замовлення не знайдено");

      return;
    }
    order.status = status;
    const historyEntry = { status, at: new Date() };
    if (req.file) {
      const photoPath = `/uploads/${req.file.filename}`;
      const currentPhotos = Array.isArray(order.photos)
        ? order.photos.filter(Boolean)
        : order.photos
        ? [order.photos].filter(Boolean)
        : [];
      order.photos = [...currentPhotos, photoPath];
      historyEntry.photo = photoPath;
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

          "Водій отримав вантаж",

          "Водій підтвердив отримання вантажу",

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

          "Доставку підтверджено",

          "Водій повідомив про доставку",

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

      if (order.driverId) {

        const driver = await User.findByPk(order.driverId);

        if (driver && driver.pushToken && driver.pushConsent) {

          const { sendPush } = require("../utils/push");

          sendPush(

            driver.pushToken,

            "Замовник підтвердив доставку",

            "Замовник підтвердив отримання вантажу",

            { orderId: order.id, navigateTo: "driverHistory" }

          );

        }

      }

    }

    res.json(order);

  } catch (err) {

    res.status(400).send("Не вдалося оновити замовлення");

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

      return res.status(404).send("Замовлення не знайдено");

    }

    if (order.customerId !== req.user.id || order.status !== "CREATED") {

      return res.status(400).send("Неможливо редагувати");

    }

    const prevPriceForHistory = order.price;

    const prevFinalPriceForHistory = order.finalPrice;



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

      "payment",

      "loadFrom",

      "loadTo",

      "unloadFrom",

      "unloadTo",

      "insurance",

      "price",

      "agreedPrice",

      "finalPrice",

    ];



    // Нормалізації для спеціальних типів

    const normalizeBoolean = (v) =>

      v === true || v === "true" || v === "1" || v === 1 || v === "on";

    const normalizeNumber = (v) => {

      const n = Number(v);

      return Number.isFinite(n) ? n : null;

    };



    fields.forEach((f) => {

      if (req.body[f] !== undefined) {

        if (f === "agreedPrice") {

          order.agreedPrice = normalizeBoolean(req.body.agreedPrice);

        } else if (f === "finalPrice") {

          const n = normalizeNumber(req.body.finalPrice);

          if (n !== null) order.finalPrice = Math.round(n);

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

          if (req.body.price === undefined) {

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

    await order.save();

    res.json(order);

  } catch (err) {

    res.status(400).send("Не вдалося оновити замовлення");

  }

}



async function deleteOrder(req, res) {

  const id = req.params.id;

  try {

    const order = await Order.findByPk(id);

    if (!order) {

      return res.status(404).send("Замовлення не знайдено");

    }

    if (order.customerId !== req.user.id || order.status !== "CREATED") {

      return res.status(400).send("Неможливо видалити");

    }

    await order.destroy();

    broadcastDelete(order.id);

    res.json({ message: "Deleted" });

  } catch (err) {

    res.status(400).send("Помилка видалення");

  }

}



// ── OrderResponse (new response flow) ──

const OrderResponse = require("../models/orderResponse");
const { ResponseStatus } = require("../models/orderResponse");

const MAX_ACTIVE_RESPONSES = 5;
const CONFIRM_TIMEOUT_MS = 30 * 60 * 1000;
const DISCUSSING_TIMEOUT_MS = 60 * 60 * 1000;

async function respondToOrder(req, res) {
  const orderId = req.params.id;
  try {
    const order = await Order.findByPk(orderId, {
      include: { model: User, as: "customer" },
    });
    if (!order || order.status !== "CREATED") {
      return res.status(400).send("Замовлення недоступне");
    }

    const activeCount = await OrderResponse.count({
      where: {
        driverId: req.user.id,
        status: { [require("sequelize").Op.in]: ["RESPONDED", "CALL_MADE", "PENDING_CONFIRM", "DISCUSSING"] },
      },
    });
    if (activeCount >= MAX_ACTIVE_RESPONSES) {
      return res.status(400).send("Ліміт активних відгуків (MAX). Завершіть поточні обговорення.");
    }

    const existing = await OrderResponse.findOne({
      where: { orderId, driverId: req.user.id, status: { [require("sequelize").Op.notIn]: ["DECLINED", "REJECTED", "EXPIRED"] } },
    });
    if (existing) {
      return res.status(400).send("Ви вже відгукнулися на це замовлення");
    }

    if (req.body && req.body.finalPrice != null && order.agreedPrice) {
      const normalized = roundPriceValue(req.body.finalPrice);
      if (normalized !== null) {
        appendPriceHistory(order, order.finalPrice ?? order.price, normalized, "finalPrice", "DRIVER", req.user.id);
        order.finalPrice = normalized;
        await order.save();
      }
    }

    const isImmediate = req.body && req.body.immediateConfirm === true;
    const initialStatus = isImmediate ? ResponseStatus.PENDING_CONFIRM : ResponseStatus.RESPONDED;

    const response = await OrderResponse.create({
      orderId,
      driverId: req.user.id,
      status: initialStatus,
      respondedAt: new Date(),
      resultSubmittedAt: isImmediate ? new Date() : null,
    });

    if (order.customer && order.customer.pushToken && order.customer.pushConsent) {
      const { sendPush } = require("../utils/push");
      const driverUser = await User.findByPk(req.user.id);
      const pushTitle = isImmediate
        ? "Водій готовий виконати замовлення"
        : "Новий відгук на замовлення";
      const pushBody = isImmediate
        ? `Водій ${driverUser?.name || ""} хоче підтвердити замовлення №${order.id}`
        : `Водій ${driverUser?.name || ""} зацікавлений у замовленні №${order.id}`;
      sendPush(
        order.customer.pushToken,
        pushTitle,
        pushBody,
        { orderId: order.id, navigateTo: "orderDetail" }
      );
    }

    broadcastOrder(order);

    res.json({
      ...response.toJSON(),
      customerPhone: order.customer ? order.customer.phone : null,
      customerName: order.customer ? order.customer.name : null,
    });
  } catch (err) {
    console.error("respondToOrder error:", err);
    res.status(400).send("Не вдалося відгукнутися");
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
    });
    if (!response) return res.status(404).send("Немає відгуку");

    const order = await Order.findByPk(orderId, {
      include: { model: User, as: "customer" },
    });

    res.json({
      ...response.toJSON(),
      customerPhone: order?.customer?.phone || null,
      customerName: order?.customer?.name || null,
    });
  } catch (err) {
    res.status(400).send("Помилка");
  }
}

async function responseCallMade(req, res) {
  const { id: orderId, responseId } = req.params;
  try {
    const response = await OrderResponse.findByPk(responseId);
    if (!response || response.orderId !== parseInt(orderId) || response.driverId !== req.user.id) {
      return res.status(400).send("Відгук не знайдено");
    }
    response.status = ResponseStatus.CALL_MADE;
    response.callMadeAt = new Date();
    await response.save();

    const order = await Order.findByPk(orderId, { include: { model: User, as: "customer" } });
    res.json({
      ...response.toJSON(),
      customerPhone: order?.customer?.phone || null,
      customerName: order?.customer?.name || null,
    });
  } catch (err) {
    res.status(400).send("Помилка");
  }
}

async function responseResult(req, res) {
  const { id: orderId, responseId } = req.params;
  const { result } = req.body;
  try {
    const response = await OrderResponse.findByPk(responseId);
    if (!response || response.orderId !== parseInt(orderId) || response.driverId !== req.user.id) {
      return res.status(400).send("Відгук не знайдено");
    }

    const order = await Order.findByPk(orderId, { include: { model: User, as: "customer" } });

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
          "Водій готовий виконати замовлення",
          `Водій ${driverUser?.name || ""} готовий виконати замовлення №${order.id}. Підтвердіть.`,
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
      return res.status(400).send("Невідомий результат");
    }

    broadcastOrder(order);
    res.json({
      ...response.toJSON(),
      customerPhone: order?.customer?.phone || null,
      customerName: order?.customer?.name || null,
    });
  } catch (err) {
    console.error("responseResult error:", err);
    res.status(400).send("Помилка");
  }
}

async function responseConfirm(req, res) {
  const { id: orderId, responseId } = req.params;
  try {
    const response = await OrderResponse.findByPk(responseId);
    if (!response || response.orderId !== parseInt(orderId) || response.status !== ResponseStatus.PENDING_CONFIRM) {
      return res.status(400).send("Неможливо підтвердити");
    }

    const order = await Order.findByPk(orderId);
    if (!order || order.customerId !== req.user.id) {
      return res.status(400).send("Немає прав");
    }
    if (order.status !== "CREATED") {
      return res.status(400).send("Замовлення вже зайняте");
    }

    response.status = ResponseStatus.CONFIRMED;
    response.confirmedAt = new Date();
    response.expiresAt = null;
    await response.save();

    order.driverId = response.driverId;
    order.status = "ACCEPTED";
    order.history = [...(order.history || []), { status: "ACCEPTED", at: new Date() }];
    await order.save();

    const { Op } = require("sequelize");
    await OrderResponse.update(
      { status: ResponseStatus.REJECTED },
      {
        where: {
          orderId,
          id: { [Op.ne]: response.id },
          status: { [Op.in]: [ResponseStatus.RESPONDED, ResponseStatus.CALL_MADE, ResponseStatus.PENDING_CONFIRM, ResponseStatus.DISCUSSING] },
        },
      }
    );

    const driver = await User.findByPk(response.driverId);
    if (driver?.pushToken && driver.pushConsent) {
      const { sendPush } = require("../utils/push");
      sendPush(
        driver.pushToken,
        "Замовник підтвердив!",
        `Замовлення №${order.id} за вами.`,
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
        sendPush(rejDriver.pushToken, "Замовник обрав іншого водія", `Замовлення №${order.id}`, { orderId: order.id });
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
    res.status(400).send("Помилка підтвердження");
  }
}

async function responseReject(req, res) {
  const { id: orderId, responseId } = req.params;
  try {
    const response = await OrderResponse.findByPk(responseId);
    if (!response || response.orderId !== parseInt(orderId)) {
      return res.status(400).send("Відгук не знайдено");
    }
    const order = await Order.findByPk(orderId);
    if (!order || order.customerId !== req.user.id) {
      return res.status(400).send("Немає прав");
    }

    response.status = ResponseStatus.REJECTED;
    await response.save();

    const driver = await User.findByPk(response.driverId);
    if (driver?.pushToken && driver.pushConsent) {
      const { sendPush } = require("../utils/push");
      sendPush(driver.pushToken, "Замовник обрав іншого водія", `Замовлення №${order.id}`, { orderId: order.id });
    }

    broadcastOrder(order);
    res.json(response);
  } catch (err) {
    res.status(400).send("Помилка відхилення");
  }
}

async function responseWithdraw(req, res) {
  const { id: orderId, responseId } = req.params;
  try {
    const response = await OrderResponse.findByPk(responseId);
    if (!response || response.orderId !== parseInt(orderId) || response.driverId !== req.user.id) {
      return res.status(400).send("Відгук не знайдено");
    }
    response.status = ResponseStatus.DECLINED;
    await response.save();
    res.json({ message: "Відгук відкликано" });
  } catch (err) {
    res.status(400).send("Помилка");
  }
}

async function getOrderResponses(req, res) {
  const orderId = req.params.id;
  try {
    const order = await Order.findByPk(orderId);
    if (!order || order.customerId !== req.user.id) {
      return res.status(400).send("Немає прав");
    }
    const responses = await OrderResponse.findAll({
      where: { orderId },
      include: [{ model: User, as: "driver", include: [{ model: DriverProfile, as: "driverProfile" }] }],
      order: [["respondedAt", "DESC"]],
    });
    const result = responses.map((r) => ({
      ...r.toJSON(),
      driverName: r.driver?.name || null,
      driverPhone: r.driver?.phone || null,
      driverRating: r.driver?.rating || null,
    }));
    res.json(result);
  } catch (err) {
    res.status(400).send("Помилка");
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
  responseConfirm,
  responseReject,
  responseWithdraw,
  getOrderResponses,
};

