const WebSocket = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');
const Order = require('./models/order');
const User = require('./models/user');
const { Op } = require('sequelize');
const { getLifecycleCutoffDate, startOfDay } = require('./utils/orderLifecycle');

let wssInstance;
const PRICE_HISTORY_STATUS = 'PRICE_UPDATED';
const DRIVER_REFUSAL_HISTORY_STATUS = 'DRIVER_REFUSAL';
const DRIVER_PRIVATE_HISTORY_STATUSES = new Set([
  PRICE_HISTORY_STATUS,
  DRIVER_REFUSAL_HISTORY_STATUS,
]);

function hasOrderUserId(value, userId) {
  return value != null && userId != null && String(value) === String(userId);
}

function canReceiveFullOrder(order, client) {
  if (!order || !client) return false;
  if (client.userRole === 'ADMIN') return true;
  if (hasOrderUserId(order.customerId, client.userId)) return true;
  if (hasOrderUserId(order.driverId, client.userId)) return true;
  if (hasOrderUserId(order.candidateDriverId, client.userId)) return true;
  if (hasOrderUserId(order.reservedBy, client.userId)) return true;

  return (
    order.status === 'CREATED' &&
    ['DRIVER', 'BOTH'].includes(client.userRole)
  );
}

function parseOrderHistory(history) {
  if (Array.isArray(history)) return history;
  if (typeof history === 'string') {
    try {
      const parsed = JSON.parse(history);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function sanitizeOrderForClient(orderJson, client) {
  if (!orderJson || !client) return orderJson;
  if (client.userRole === 'ADMIN' || hasOrderUserId(orderJson.customerId, client.userId)) {
    return orderJson;
  }

  const history = parseOrderHistory(orderJson.history);
  if (!history.length) return orderJson;

  let resetIndex = -1;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (
      entry?.status === 'CREATED' &&
      entry?.reason === DRIVER_REFUSAL_HISTORY_STATUS
    ) {
      resetIndex = i;
      break;
    }
  }

  const visibleHistory = resetIndex >= 0 ? history.slice(resetIndex) : history;
  return {
    ...orderJson,
    history: visibleHistory
      .filter((entry) => !DRIVER_PRIVATE_HISTORY_STATUSES.has(entry?.status))
      .map((entry) => {
        if (
          entry?.status === 'CREATED' &&
          entry?.reason === DRIVER_REFUSAL_HISTORY_STATUS
        ) {
          const { reason, label, changedByRole, changedById, ...rest } = entry;
          return rest;
        }
        return entry;
      }),
  };
}

// Build a UTC day range from a textual `date` filter.
function buildUtcDayRange(dateStr) {
  const { parseDate } = require('./utils/date');
  const parsed = parseDate(dateStr);
  if (!parsed) return null;
  const y = parsed.getFullYear();
  const m = parsed.getMonth();
  const d = parsed.getDate();
  const start = new Date(Date.UTC(y, m, d));
  const end = new Date(Date.UTC(y, m, d + 1));
  return { start, end };
}

// Build a UTC range from `dateFrom` to `dateTo` (DD.MM or DD.MM.YYYY).
function buildUtcDateRange(dateFromStr, dateToStr) {
  const { parseDate } = require('./utils/date');
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

function buildAvailableDateCondition(query, now) {
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

  if (query.dateFrom && query.dateTo) {
    const range = buildUtcDateRange(query.dateFrom, query.dateTo);
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
  } else if (query.date) {
    const range = buildUtcDayRange(query.date);
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

function buildWhere(query, userId, ignoreReserve = false) {
  const where = {
    [Op.or]: [
      { status: 'CREATED' },
      { status: 'PENDING', candidateDriverId: userId },
    ],
  };
  const city = query.pickupCity || query.city;
  if (city) where.pickupCity = city;
  if (query.dropoffCity) where.dropoffCity = query.dropoffCity;
  const now = new Date();

  if (!ignoreReserve) {
    where[Op.and] = [
      {
        [Op.or]: [
          { reservedBy: null },
          { reservedUntil: { [Op.lt]: now } },
          { reservedBy: userId },
        ],
      },
      buildAvailableDateCondition(query, now),
    ];
  } else {
    where[Op.and] = [buildAvailableDateCondition(query, now)];
  }

  return where;
}

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ noServer: true });
  wssInstance = wss;

  server.on('upgrade', async (req, socket, head) => {
    const pathname = url.parse(req.url).pathname;
    if (pathname === '/api/orders/stream') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws, req) => {
    try {
      const auth = req.headers['authorization'];
      if (!auth) return ws.close();
      const token = auth.split(' ')[1];
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await User.findByPk(payload.id);
      if (!user || user.blocked) return ws.close();
      req.user = user;
      ws.userId = user.id;
      ws.userRole = user.role;
    } catch {
      return ws.close();
    }

    const query = url.parse(req.url, true).query;
    const filterWhere = buildWhere(query, req.user.id);
    const updateWhere = buildWhere(query, req.user.id, true);

    const orders = await Order.findAll({
      where: filterWhere,
      include: [{ model: User, as: 'customer' }],
    });
    for (const o of orders) {
      const orderJson = typeof o?.toJSON === 'function' ? o.toJSON() : o;
      ws.send(JSON.stringify(sanitizeOrderForClient(orderJson, ws)));
    }

    let lastCheck = new Date();
    const interval = setInterval(async () => {
      const updated = await Order.findAll({
        where: {
          ...updateWhere,
          updatedAt: { [Op.gt]: lastCheck },
        },
        include: [{ model: User, as: 'customer' }],
      });
      lastCheck = new Date();
      updated.forEach((o) => {
        const orderJson = typeof o?.toJSON === 'function' ? o.toJSON() : o;
        ws.send(JSON.stringify(sanitizeOrderForClient(orderJson, ws)));
      });
    }, 5000);

    ws.on('close', () => clearInterval(interval));
  });
}

function broadcastOrder(order) {
  if (!wssInstance) return;
  const orderJson = typeof order?.toJSON === 'function' ? order.toJSON() : order;
  const unavailableData = JSON.stringify({ id: orderJson?.id, unavailable: true });
  wssInstance.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      if (canReceiveFullOrder(orderJson, client)) {
        client.send(JSON.stringify(sanitizeOrderForClient(orderJson, client)));
      } else if (['DRIVER', 'BOTH'].includes(client.userRole)) {
        client.send(unavailableData);
      }
    }
  });
}

function broadcastDelete(id) {
  if (!wssInstance) return;
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  const data = JSON.stringify({ id: numId, deleted: true });
  wssInstance.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

module.exports = { setupWebSocket, broadcastOrder, broadcastDelete };
