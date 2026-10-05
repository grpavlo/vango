const express = require('express');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const path = require('path');
const http = require('http');
const https = require('https');
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const financialRoutes = require('./routes/financialRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const savedSearchRoutes = require('./routes/savedSearchRoutes');
const driverProfileRoutes = require('./routes/driverProfileRoutes');
const supportRoutes = require('./routes/supportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { setupWebSocket } = require('./ws');
const Order = require('./models/order');
const { OrderStatus } = require('./models/order');
require('./models/orderResponse');
require('./models/orderRouteSearchEvent');
require('./models/group');
require('./models/supportQuestion');
require('./models/portalAdmin');
require('./models/notification');
const { startOrderLifecycleScheduler } = require('./services/orderLifecycleScheduler');
const {
  ensurePortalAdminFromEnv,
  syncPortalAdminsFromLegacyUsers,
} = require('./services/portalAdmins');
const { getLifecycleCutoffDate } = require('./utils/orderLifecycle');
const { Op } = require('sequelize');

const PORT = process.env.NODE_ENV === 'production'
    ? Number(process.env.PORT_PROD ?? 3000)
    : Number(process.env.PORT ?? 3000)

const app = express();
const portalProxyTarget = process.env.VANGO_WEB_PORTAL_PROXY_TARGET || 'http://127.0.0.1:5173';

function isPortalProxyEnabled() {
  return !['0', 'false', 'off', ''].includes(String(portalProxyTarget).trim().toLowerCase());
}

function createPortalProxyRequest(req, res, next) {
  if (!isPortalProxyEnabled()) return next();

  let targetUrl;
  try {
    targetUrl = new URL(req.originalUrl, portalProxyTarget);
  } catch {
    return next();
  }

  const proxyClient = targetUrl.protocol === 'https:' ? https : http;
  const headers = {
    ...req.headers,
    host: targetUrl.host,
    'x-forwarded-host': req.headers.host,
    'x-forwarded-proto': req.protocol,
    'x-forwarded-for': req.ip,
  };

  const proxyReq = proxyClient.request(
    targetUrl,
    {
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.statusCode = proxyRes.statusCode || 502;
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value !== undefined) res.setHeader(key, value);
      }
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', () => {
    if (!res.headersSent && ['GET', 'HEAD'].includes(req.method)) return next();
    if (!res.headersSent) res.status(502).send('New portal is not available');
  });

  req.pipe(proxyReq);
}

function proxyPortalUpgrade(req, socket, head) {
  if (!isPortalProxyEnabled() || !req.url?.startsWith('/portal')) return false;

  let targetUrl;
  try {
    targetUrl = new URL(req.url, portalProxyTarget);
  } catch {
    return false;
  }

  req._vangoPortalProxyHandled = true;
  const proxyClient = targetUrl.protocol === 'https:' ? https : http;
  const headers = {
    ...req.headers,
    host: targetUrl.host,
    'x-forwarded-host': req.headers.host,
    'x-forwarded-proto': 'ws',
  };

  const proxyReq = proxyClient.request({
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: `${targetUrl.pathname}${targetUrl.search}`,
    method: req.method,
    headers,
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/${req.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n` +
        Object.entries(proxyRes.headers)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('\r\n') +
        '\r\n\r\n'
    );
    if (proxyHead.length) proxySocket.unshift(proxyHead);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on('error', () => socket.destroy());
  proxyReq.end(head.length ? head : undefined);
  return true;
}

app.use('/portal', createPortalProxyRequest);
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/portal', express.static(path.join(__dirname, '../web-portal')));
app.get('/portal/logo.png', (_req, res) => {
  res.sendFile(path.join(__dirname, '../logo.png'));
});
app.get('/portal/analytics', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web-portal/analytics/index.html'));
});
app.get('/portal/analytics/drivers', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web-portal/analytics/drivers/index.html'));
});
app.get('/portal/analytics/orders', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web-portal/analytics/orders/index.html'));
});
app.get('/portal/create-order', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web-portal/create-order/index.html'));
});
app.get('/portal/analysts', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web-portal/analytics/index.html'));
});
app.get('/portal/analysts/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web-portal/analytics/index.html'));
});
app.get('/portal/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web-portal/index.html'));
});
app.get('/portal/orders', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web-portal/index.html'));
});
app.get('/portal/users', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web-portal/index.html'));
});
app.get('/portal/admins', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web-portal/index.html'));
});
app.get('/portal/groups', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web-portal/index.html'));
});
app.get('/portal/support', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web-portal/index.html'));
});

app.use('/api/auth', authRoutes);
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/finance', financialRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/saved-searches', savedSearchRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use("/api", driverProfileRoutes);


function scheduleCleanup() {
  async function cleanup() {
    const cutoff = getLifecycleCutoffDate(new Date());
    await Order.destroy({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              {
                freeDate: true,
                freeDateUntil: { [Op.lt]: cutoff },
              },
              {
                freeDate: { [Op.not]: true },
                unloadTo: { [Op.lt]: cutoff },
              },
              {
                freeDate: { [Op.not]: true },
                unloadTo: null,
                loadFrom: { [Op.lt]: cutoff },
              },
            ],
          },
          {
            [Op.not]: {
              [Op.or]: [
                { status: OrderStatus.COMPLETED },
                { driverId: { [Op.ne]: null } },
                {
                  status: {
                    [Op.in]: [
                      OrderStatus.ACCEPTED,
                      OrderStatus.IN_PROGRESS,
                      OrderStatus.DELIVERED,
                      OrderStatus.PENDING,
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    });
  }
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  setTimeout(function run() {
    cleanup().catch(() => {});
    next.setDate(next.getDate() + 1);
    const delay = next - Date.now();
    setTimeout(run, delay);
  }, next - now);
}

async function removeInvalidFavorites() {
  try {
    await db.query(`
      DELETE FROM "favorites"
      WHERE "customerId" NOT IN (SELECT id FROM "users")
         OR "driverId" NOT IN (SELECT id FROM "users");
    `);
  } catch (e) {
    // Ignore errors if table doesn't exist
  }
}

async function start() {
  try {
    await removeInvalidFavorites();
    await db.sync({ alter: true });
    await syncPortalAdminsFromLegacyUsers();
    await ensurePortalAdminFromEnv();
    const server = http.createServer(app);
    server.on('upgrade', (req, socket, head) => {
      proxyPortalUpgrade(req, socket, head);
    });
    setupWebSocket(server);
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    scheduleCleanup();
    startOrderLifecycleScheduler();
  } catch (err) {
    console.error('Failed to start server', err);
  }
}

start();
