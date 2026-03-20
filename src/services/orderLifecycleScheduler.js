const { Op } = require("sequelize");
const Order = require("../models/order");
const { OrderStatus } = require("../models/order");
const User = require("../models/user");
const OrderRouteSearchEvent = require("../models/orderRouteSearchEvent");
const { sendPush } = require("../utils/push");
const { broadcastOrder } = require("../ws");
const {
  REMINDER_PLAN,
  getOrderLifecycle,
  getOrderReferenceDate,
  dueAtFromReference,
} = require("../utils/orderLifecycle");

const SCHEDULER_INTERVAL_MS = 15 * 60 * 1000;

function formatDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeSentSteps(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string");
}

function buildReminderText(stepKey, order, searchedToday) {
  const route = `${order.pickupCity || "Місце завантаження"} → ${
    order.dropoffCity || "Місце розвантаження"
  }`;
  const title = "Оновіть дати замовлення";

  switch (stepKey) {
    case "D0":
      return {
        title,
        body: "Активний час вашого замовлення сьогодні закінчується. Якщо замовлення актуальне — оновіть дати завантаження та розвантаження.",
      };
    case "D2":
      return {
        title,
        body: "Нагадуємо оновити дати завантаження/розвантаження. Підказку зі скріншотом дивіться у замовленні.",
      };
    case "D4":
      return {
        title,
        body: "Нагадуємо оновити дати. Через неактуальні дати замовлення опускається вниз списку пошуку.",
      };
    case "D6":
      return {
        title,
        body: `Нагадуємо оновити дати. Сьогодні ${searchedToday} водіїв шукали вантажі за маршрутом ${route}.`,
      };
    case "D9":
      return {
        title,
        body: `Нагадуємо оновити дати. Сьогодні ${searchedToday} водіїв шукали вантажі за маршрутом ${route}.`,
      };
    case "D11":
      return {
        title,
        body: "Нагадуємо оновити дати. Через 3 дні замовлення буде автоматично закрито на сайті.",
      };
    case "D13":
      return {
        title,
        body: "😔 Замовлення досі не оновлене. Завтра ми автоматично закриємо його як неактуальне.",
      };
    default:
      return null;
  }
}

async function getTodayRouteSearchCount(orderId, now = new Date()) {
  const dayKey = formatDayKey(now);
  return OrderRouteSearchEvent.count({
    where: { orderId, dayKey },
  });
}

async function sendReminder(order, stepKey, now = new Date()) {
  if (!order?.customer?.pushToken || !order?.customer?.pushConsent) return false;

  let searchedToday = 0;
  if (stepKey === "D6" || stepKey === "D9") {
    searchedToday = await getTodayRouteSearchCount(order.id, now);
  }
  const payload = buildReminderText(stepKey, order, searchedToday);
  if (!payload) return false;

  await sendPush(order.customer.pushToken, payload.title, payload.body, {
    orderId: order.id,
    navigateTo: "orderDetail",
    reminderStep: stepKey,
  });
  return true;
}

async function autoCloseOrder(order, now = new Date()) {
  order.status = OrderStatus.CANCELLED;
  order.history = [
    ...(order.history || []),
    {
      status: OrderStatus.CANCELLED,
      at: now,
      note: "Автоматично закрито через неактуальні дати",
    },
  ];
  await order.save();
  broadcastOrder(order);

  if (order?.customer?.pushToken && order?.customer?.pushConsent) {
    await sendPush(
      order.customer.pushToken,
      "Замовлення автоматично закрито",
      "Ми закрили замовлення, бо дати не були оновлені протягом 14 днів після завершення актуальності.",
      { orderId: order.id, navigateTo: "orderDetail", reason: "autoCloseByDates" }
    );
  }
}

async function processOrderLifecycleReminders() {
  const now = new Date();
  const orders = await Order.findAll({
    where: {
      status: { [Op.in]: [OrderStatus.CREATED] },
    },
    include: [{ model: User, as: "customer" }],
  });

  for (const order of orders) {
    const lifecycle = getOrderLifecycle(order, now);
    if (!lifecycle.hasReferenceDate) continue;

    if (lifecycle.isAutoCloseDue) {
      await autoCloseOrder(order, now);
      continue;
    }

    const sentSteps = new Set(normalizeSentSteps(order.lifecycleRemindersSent));
    const referenceDate = getOrderReferenceDate(order);
    if (!referenceDate) continue;

    const dueSteps = REMINDER_PLAN.filter((step) => {
      if (sentSteps.has(step.key)) return false;
      const dueAt = dueAtFromReference(referenceDate, step.dayOffset);
      return now >= dueAt;
    });

    if (dueSteps.length === 0) continue;

    const latestDue = dueSteps[dueSteps.length - 1];
    await sendReminder(order, latestDue.key, now);
    for (const step of dueSteps) {
      sentSteps.add(step.key);
    }
    order.lifecycleRemindersSent = Array.from(sentSteps);
    await order.save();
  }
}

function startOrderLifecycleScheduler() {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processOrderLifecycleReminders();
    } catch (err) {
      console.error("order lifecycle scheduler failed", err);
    } finally {
      running = false;
    }
  };

  setTimeout(run, 10 * 1000);
  setInterval(run, SCHEDULER_INTERVAL_MS);
}

module.exports = { startOrderLifecycleScheduler, processOrderLifecycleReminders };
