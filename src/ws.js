const WebSocket = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');
const Order = require('./models/order');
const User = require('./models/user');
const { Op } = require('sequelize');

let wssInstance;

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
  if (query.date) {
    const { parseDate } = require('./utils/date');
    const parsed = parseDate(query.date);
    console.log('[buildWhere] date query=', query.date, 'parsed=', parsed);
    if (parsed) {
      const start = new Date(parsed);
      const end = new Date(parsed);
      end.setDate(end.getDate() + 1);
      where.loadFrom = { [Op.gte]: start };
      where.loadTo = { [Op.lt]: end };
    }
  }
  if (query.minWeight || query.maxWeight) {
    where.weight = {};
    if (query.minWeight) where.weight[Op.gte] = parseFloat(query.minWeight);
    if (query.maxWeight) where.weight[Op.lte] = parseFloat(query.maxWeight);
  }
  if (!ignoreReserve) {
    const now = new Date();
    where[Op.and] = [
      {
        [Op.or]: [
          { reservedBy: null },
          { reservedUntil: { [Op.lt]: now } },
          { reservedBy: userId },
        ],
      },
    ];
  }
  console.log('[buildWhere] where=', JSON.stringify(where));
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
