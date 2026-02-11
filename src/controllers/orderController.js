const Order = require("../models/order");

const { OrderStatus } = require("../models/order");

const Transaction = require("../models/transaction");

const User = require("../models/user");

const DriverProfile = require("../models/driverProfile");

const { SERVICE_FEE_PERCENT } = require("../config");

const { broadcastOrder, broadcastDelete } = require("../ws");



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

      photos: req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [],

      history: [{ status: "CREATED", at: new Date() }],

    });

    broadcastOrder(order);

    res.json(order);

  } catch (err) {

    res.status(400).send("Не вдалося створити замовлення");

  }

}



async function listAvailableOrders(req, res) {

  const { city, pickupCity, dropoffCity, date, lat, lon, radius } = req.query;

  const { Op } = require("sequelize");



  const where = {

    [Op.or]: [

      { status: "CREATED" },

      { status: "PENDING", candidateDriverId: req.user.id },

    ],

  };

  const cityFilter = pickupCity || city;

  if (cityFilter) where.pickupCity = cityFilter;

  if (dropoffCity) where.dropoffCity = dropoffCity;



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

  if (date) {
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



  function inRadius(order) {

    if (!searchRadius || isNaN(centerLat) || isNaN(centerLon)) return true;

    if (!order.pickupLat || !order.pickupLon) return false;

    const R = 6371; // km

    const dLat = ((order.pickupLat - centerLat) * Math.PI) / 180;

    const dLon = ((order.pickupLon - centerLon) * Math.PI) / 180;

    const a =

      Math.sin(dLat / 2) * Math.sin(dLat / 2) +

      Math.cos(centerLat * (Math.PI / 180)) *

        Math.cos(order.pickupLat * (Math.PI / 180)) *

        Math.sin(dLon / 2) *

        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;

    return distance <= searchRadius;

  }



  const filtered = orders.filter(inRadius);



  const takenOrders = await Order.findAll({

    where: { status: "ACCEPTED" },

    limit: Math.floor(filtered.length / 15),

  });

  res.json({ available: filtered, taken: takenOrders });

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

  const orders = await Order.findAll({

    where,

    include: [

      userIncludeWithProfile("driver"),

      userIncludeWithProfile("candidateDriver"),

      userIncludeWithProfile("reservedDriver"),

      { model: User, as: "customer" },

    ],

  });

  res.json(orders);

}



async function getOrder(req, res) {

  const id = req.params.id;

  try {

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

    res.json(order);

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

  updateFinalPrice

};

