const WebSocket = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');
const Order = require('./models/order');
const User = require('./models/user');
const { Op } = require('sequelize');

let wssInstance;

// Діапазон дня в UTC з текстового параметра `date`, щоб фільтр по даті
// не залежав від часовго поясу сервера.
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
    const andConditions = [
      {
        [Op.or]: [
          { reservedBy: null },
          { reservedUntil: { [Op.lt]: now } },
          { reservedBy: userId },
        ],
      },
    ];
    
    if (query.date) {
      const range = buildUtcDayRange(query.date);
      if (range) {
        where.loadFrom = { [Op.gte]: range.start };
        where.loadTo = { [Op.lt]: range.end };
      }
    } else {
      // Якщо дата не передана, показуємо тільки майбутні замовлення
      andConditions.push({ loadFrom: { [Op.gte]: now } });
    }
    
    where[Op.and] = andConditions;
  } else {
    // Якщо ignoreReserve = true, все одно потрібно фільтрувати за датою
    if (query.date) {
      const range = buildUtcDayRange(query.date);
      if (range) {
        where.loadFrom = { [Op.gte]: range.start };
        where.loadTo = { [Op.lt]: range.end };
      }
    } else {
      where.loadFrom = { [Op.gte]: now };
    }
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
