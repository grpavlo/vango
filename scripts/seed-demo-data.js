const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const db = require("../src/config/db");
const Group = require("../src/models/group");
const User = require("../src/models/user");
const { UserRole } = require("../src/models/user");
const DriverProfile = require("../src/models/driverProfile");
const Order = require("../src/models/order");
const { OrderStatus, RequestedOrderType, TimingOption } = require("../src/models/order");
const PortalAdmin = require("../src/models/portalAdmin");
const OrderResponse = require("../src/models/orderResponse");
const { ResponseStatus, ArrivalEta } = require("../src/models/orderResponse");
const Favorite = require("../src/models/favorite");
const Rating = require("../src/models/rating");
const Notification = require("../src/models/notification");
const { normalizePhone } = require("../src/services/authCodes");

require("../src/models/orderRouteSearchEvent");
require("../src/models/supportQuestion");
require("../src/models/savedSearch");
require("../src/models/transaction");

const ADMIN_PHONE = "0979386433";
const ADMIN_PHONE_NORMALIZED = normalizePhone(ADMIN_PHONE);
const batch = new Date().toISOString().replace(/\D/g, "").slice(0, 14);

function addDays(days, hour = 10, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function money(distance, base = 45) {
  return Math.round(distance * base + 350);
}

function phone(index) {
  return normalizePhone(`0977${String(batch).slice(-4)}${String(index).padStart(3, "0")}`);
}

function history(...statuses) {
  return statuses.map((status, index) => ({
    status,
    at: addDays(-statuses.length + index, 9 + index),
  }));
}

async function upsertAdmin(passwordHash) {
  let user = await User.findOne({
    where: {
      [Op.or]: [
        { phone: ADMIN_PHONE_NORMALIZED },
        { email: `user_${ADMIN_PHONE_NORMALIZED}@vango.phone` },
      ],
    },
  });

  if (!user) {
    user = await User.create({
      name: "Адміністратор VanGo",
      email: `user_${ADMIN_PHONE_NORMALIZED}@vango.phone`,
      password: passwordHash,
      role: UserRole.BOTH,
      isAdmin: true,
      phone: ADMIN_PHONE_NORMALIZED,
      city: "Київ",
      pushConsent: true,
      balance: 0,
    });
  } else {
    user.name = user.name || "Адміністратор VanGo";
    user.phone = ADMIN_PHONE_NORMALIZED;
    user.role = user.role === UserRole.ADMIN ? UserRole.BOTH : user.role;
    user.isAdmin = true;
    user.blocked = false;
    await user.save();
  }

  let admin = await PortalAdmin.findOne({
    where: {
      [Op.or]: [
        { phone: ADMIN_PHONE_NORMALIZED },
        { email: String(user.email).toLowerCase() },
      ],
    },
  });

  if (!admin) {
    admin = await PortalAdmin.create({
      name: user.name,
      email: String(user.email).toLowerCase(),
      phone: ADMIN_PHONE_NORMALIZED,
      password: passwordHash,
      active: true,
    });
  } else {
    admin.name = admin.name || user.name;
    admin.email = String(admin.email || user.email).toLowerCase();
    admin.phone = ADMIN_PHONE_NORMALIZED;
    admin.active = true;
    await admin.save();
  }

  return { user, admin };
}

async function createGroups() {
  const names = ["Київська команда", "Львівські перевезення", "Одеса логістика"];
  const groups = [];
  for (const name of names) {
    const [group] = await Group.findOrCreate({ where: { name }, defaults: { name } });
    groups.push(group);
  }
  return groups;
}

async function createUsers(passwordHash, groups) {
  const customers = [
    ["Олена Коваленко", "Київ", 1],
    ["Ігор Мельник", "Львів", 2],
    ["Марія Бондар", "Одеса", 3],
    ["Андрій Савчук", "Дніпро", 4],
    ["Наталія Романюк", "Харків", 5],
  ];
  const drivers = [
    ["Сергій Рябенко", "Київ", 101, "Volkswagen", "Crafter", "AA4512KA"],
    ["Петро Ткачук", "Львів", 102, "Renault", "Master", "BC2177HX"],
    ["Василь Гончар", "Одеса", 103, "Mercedes-Benz", "Sprinter", "BH8890OP"],
    ["Дмитро Шевченко", "Дніпро", 104, "Ford", "Transit", "AE7231IT"],
    ["Юрій Литвин", "Харків", 105, "Fiat", "Ducato", "AX5520KM"],
  ];

  const createdCustomers = [];
  for (const [name, city, index] of customers) {
    createdCustomers.push(
      await User.create({
        name,
        email: `customer_${batch}_${index}@vango.test`,
        password: passwordHash,
        role: UserRole.CUSTOMER,
        city,
        phone: phone(index),
        groupId: groups[index % groups.length].id,
        rating: 4.6 + (index % 4) * 0.1,
        pushConsent: index % 2 === 0,
        balance: 500 + index * 120,
      })
    );
  }

  const createdDrivers = [];
  for (const [name, city, index, make, model, plate] of drivers) {
    const driver = await User.create({
      name,
      email: `driver_${batch}_${index}@vango.test`,
      password: passwordHash,
      role: UserRole.DRIVER,
      city,
      phone: phone(index),
      groupId: groups[index % groups.length].id,
      rating: 4.5 + (index % 5) * 0.1,
      pushConsent: true,
      balance: 900 + index * 10,
    });

    await DriverProfile.create({
      userId: driver.id,
      fullName: name,
      inn: `30${batch.slice(-6)}${String(index).slice(-2)}`,
      passportSeries: "СТ",
      passportNumber: `${batch.slice(-4)}${String(index).slice(-2)}`,
      driverLicenseSeries: "ВАА",
      driverLicenseNumber: `${batch.slice(-5)}${String(index).slice(-2)}`,
      vehicleTechSeries: "СХТ",
      vehicleTechNumber: `${batch.slice(-5)}${String(index).slice(-2)}`,
      carMake: make,
      carModel: model,
      carYear: 2018 + (index % 6),
      carPlate: plate,
      carLengthMm: 3200 + (index % 4) * 300,
      carWidthMm: 1650 + (index % 3) * 80,
      carHeightMm: 1700 + (index % 3) * 120,
      status: index % 2 === 0 ? "APPROVED" : "SUBMITTED",
    });

    createdDrivers.push(driver);
  }

  return { customers: createdCustomers, drivers: createdDrivers };
}

async function createOrders(customers, drivers) {
  const templates = [
    ["Київ, вул. Антоновича 52", "Київ, просп. Берестейський 89", "Київ", "Київ", "побутова техніка", 12, OrderStatus.CREATED],
    ["Львів, вул. Городоцька 174", "Львів, вул. Зелена 147", "Львів", "Львів", "офісні меблі", 9, OrderStatus.PENDING],
    ["Одеса, вул. Балківська 42", "Одеса, Французький бульвар 22", "Одеса", "Одеса", "коробки з товаром", 7, OrderStatus.CREATED],
    ["Дніпро, вул. Робоча 12", "Запоріжжя, просп. Соборний 155", "Дніпро", "Запоріжжя", "будматеріали", 86, OrderStatus.ACCEPTED],
    ["Харків, вул. Полтавський Шлях 65", "Полтава, вул. Європейська 101", "Харків", "Полтава", "медичне обладнання", 145, OrderStatus.IN_PROGRESS],
    ["Київ, вул. Саксаганського 70", "Житомир, вул. Київська 77", "Київ", "Житомир", "велосипеди", 138, OrderStatus.DELIVERED],
    ["Львів, вул. Кульпарківська 200", "Івано-Франківськ, вул. Незалежності 40", "Львів", "Івано-Франківськ", "вітрини", 135, OrderStatus.COMPLETED],
    ["Одеса, Привоз", "Миколаїв, Центральний проспект 98", "Одеса", "Миколаїв", "продукти", 132, OrderStatus.CANCELLED],
    ["Київ, Оболонська набережна 7", "Чернігів, просп. Миру 44", "Київ", "Чернігів", "дитячі меблі", 150, OrderStatus.REJECTED],
    ["Вінниця, вул. Київська 16", "Хмельницький, вул. Кам'янецька 55", "Вінниця", "Хмельницький", "поліграфія", 122, OrderStatus.CREATED],
    ["Тернопіль, вул. Руська 21", "Рівне, вул. Соборна 12", "Тернопіль", "Рівне", "тканини", 155, OrderStatus.PENDING],
    ["Черкаси, бул. Шевченка 305", "Кременчук, вул. Соборна 4", "Черкаси", "Кременчук", "запчастини", 130, OrderStatus.CREATED],
  ];

  const orders = [];
  for (let index = 0; index < templates.length; index += 1) {
    const [pickupLocation, dropoffLocation, pickupCity, dropoffCity, cargoType, distance, status] = templates[index];
    const customer = customers[index % customers.length];
    const driver = [OrderStatus.ACCEPTED, OrderStatus.IN_PROGRESS, OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(status)
      ? drivers[index % drivers.length]
      : null;
    const isLocal = pickupCity === dropoffCity;
    const loadFrom = addDays(index % 4, 8 + (index % 8), index % 2 ? 30 : 0);
    const loadTo = new Date(loadFrom.getTime() + 90 * 60 * 1000);
    const unloadFrom = new Date(loadTo.getTime() + (isLocal ? 60 : 8 * 60) * 60 * 1000);
    const unloadTo = new Date(unloadFrom.getTime() + 2 * 60 * 60 * 1000);
    const price = isLocal ? 0 : money(distance, 42 + (index % 4) * 4);
    const statuses = status === OrderStatus.CREATED
      ? [OrderStatus.CREATED]
      : [OrderStatus.CREATED, status];

    const order = await Order.create({
      customerId: customer.id,
      driverId: driver?.id || null,
      pickupLocation,
      dropoffLocation,
      pickupCountry: "Україна",
      pickupCity,
      pickupAddress: pickupLocation,
      pickupPostcode: String(10000 + index),
      dropoffCountry: "Україна",
      dropoffCity,
      dropoffAddress: dropoffLocation,
      dropoffPostcode: String(20000 + index),
      isIntraCity: isLocal,
      requestedOrderType: isLocal ? RequestedOrderType.LOCAL : RequestedOrderType.LONG_DISTANCE,
      timingOption: isLocal ? [TimingOption.ASAP, TimingOption.WITHIN_1_HOUR, TimingOption.SCHEDULED][index % 3] : null,
      cargoType,
      pickupLat: 50.45 + index * 0.06,
      pickupLon: 30.52 + index * 0.05,
      dropoffLat: 50.5 + index * 0.07,
      dropoffLon: 30.6 + index * 0.06,
      loadHelp: index % 2 === 0,
      unloadHelp: index % 3 === 0,
      freeDate: index === 10,
      freeDateUntil: index === 10 ? addDays(3, 18) : null,
      payment: index % 2 === 0 ? "card" : "cash",
      loadFrom,
      loadTo,
      unloadFrom,
      unloadTo,
      insurance: index % 3 === 1,
      status,
      systemPrice: money(distance),
      price,
      agreedPrice: isLocal || index % 5 === 0,
      finalPrice: [OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(status) ? price || 850 : null,
      reservedBy: status === OrderStatus.PENDING ? drivers[(index + 1) % drivers.length].id : null,
      reservedUntil: status === OrderStatus.PENDING ? addDays(0, 23, 30) : null,
      candidateDriverId: status === OrderStatus.PENDING ? drivers[(index + 2) % drivers.length].id : null,
      candidateUntil: status === OrderStatus.PENDING ? addDays(0, 23, 45) : null,
      distance,
      cargoLength: 1.2 + (index % 5) * 0.4,
      cargoWidth: 0.7 + (index % 4) * 0.2,
      cargoHeight: 0.8 + (index % 3) * 0.3,
      cargoVolume: 1.1 + (index % 6) * 0.5,
      cargoWeight: 80 + index * 35,
      photos: [],
      history: history(...statuses),
      lifecycleRemindersSent: [],
    });
    order.orderNumber = order.id;
    await order.save();
    orders.push(order);
  }

  return orders;
}

async function createRelatedData(customers, drivers, orders) {
  for (let index = 0; index < Math.min(customers.length, drivers.length); index += 1) {
    await Favorite.create({
      customerId: customers[index].id,
      driverId: drivers[(index + 1) % drivers.length].id,
    });
  }

  const openOrders = orders.filter((order) => [OrderStatus.CREATED, OrderStatus.PENDING].includes(order.status));
  for (let index = 0; index < openOrders.length; index += 1) {
    await OrderResponse.create({
      orderId: openOrders[index].id,
      driverId: drivers[index % drivers.length].id,
      status: [ResponseStatus.RESPONDED, ResponseStatus.CALL_MADE, ResponseStatus.COUNTER_OFFERED][index % 3],
      respondedAt: addDays(-1, 12 + index),
      callMadeAt: index % 2 === 0 ? addDays(-1, 13 + index) : null,
      expiresAt: addDays(1, 18),
      hourlyRate: 450 + index * 25,
      minHours: 2 + (index % 3),
      arrivalEta: [ArrivalEta.UP_TO_15_MIN, ArrivalEta.UP_TO_30_MIN, ArrivalEta.UP_TO_1_HOUR, ArrivalEta.AT_APPOINTED_TIME][index % 4],
      offerTotal: 900 + index * 180,
      finalPriceOffer: 850 + index * 160,
    });
  }

  const completed = orders.find((order) => order.status === OrderStatus.COMPLETED);
  if (completed?.driverId) {
    await Rating.create({
      orderId: completed.id,
      fromUserId: completed.customerId,
      toUserId: completed.driverId,
      rating: 5,
      comment: "Швидко, акуратно, все вчасно.",
    });
    await Rating.create({
      orderId: completed.id,
      fromUserId: completed.driverId,
      toUserId: completed.customerId,
      rating: 5,
      comment: "Замовник був на зв'язку, адреси точні.",
    });
  }

  for (const order of orders.slice(0, 8)) {
    await Notification.create({
      userId: order.customerId,
      title: `Оновлення замовлення #${order.orderNumber}`,
      body: `Статус: ${order.status}`,
      data: { orderId: order.id, demoBatch: batch },
      read: order.status !== OrderStatus.CREATED,
      receivedAt: addDays(-1, 10),
    });
  }
}

async function main() {
  await db.sync({ alter: true });

  const passwordHash = await bcrypt.hash("pass", 10);
  const { user: adminUser, admin } = await upsertAdmin(passwordHash);
  const groups = await createGroups();
  const { customers, drivers } = await createUsers(passwordHash, groups);
  const orders = await createOrders(customers, drivers);
  await createRelatedData(customers, drivers, orders);

  console.log(`Demo batch: ${batch}`);
  console.log(`Admin phone: ${ADMIN_PHONE_NORMALIZED}`);
  console.log(`Admin user id: ${adminUser.id}`);
  console.log(`Portal admin id: ${admin.id}`);
  console.log(`Created customers: ${customers.length}`);
  console.log(`Created drivers: ${drivers.length}`);
  console.log(`Created orders: ${orders.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.close();
  });
