const WebSocket = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');
const Order = require('./models/order');
const User = require('./models/user');
const { Op } = require('sequelize');

let wssInstance;

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
  const activeFreeDateCondition = {
    freeDate: true,
    freeDateUntil: { [Op.gte]: now },
  };
  const regularOrderCondition = {
    freeDate: { [Op.not]: true },
  };

  if (query.dateFrom && query.dateTo) {
    const range = buildUtcDateRange(query.dateFrom, query.dateTo);
    if (range) {
      return {
        [Op.or]: [
          activeFreeDateCondition,
          {
            ...regularOrderCondition,
            loadFrom: { [Op.gte]: range.start, [Op.lt]: range.end },
          },
        ],
      };
    }
  } else if (query.date) {
    const range = buildUtcDayRange(query.date);
    if (range) {
      return {
        [Op.or]: [
          activeFreeDateCondition,
          {
            ...regularOrderCondition,
            loadFrom: { [Op.gte]: range.start },
            loadTo: { [Op.lt]: range.end },
          },
        ],
      };
    }
  }

  return {
    [Op.or]: [
      activeFreeDateCondition,
      {
        ...regularOrderCondition,
        loadFrom: { [Op.gte]: now },
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
    Object.assign(where, buildAvailableDateCondition(query, now));
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
      ws.send(JSON.stringify(o));
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
      updated.forEach((o) => ws.send(JSON.stringify(o)));
    }, 5000);

    ws.on('close', () => clearInterval(interval));
  });
}

function broadcastOrder(order) {
  if (!wssInstance) return;
  const data = JSON.stringify(order);
  wssInstance.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
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
