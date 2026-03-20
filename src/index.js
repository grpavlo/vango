const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const financialRoutes = require('./routes/financialRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const savedSearchRoutes = require('./routes/savedSearchRoutes');
const driverProfileRoutes = require('./routes/driverProfileRoutes');
const { setupWebSocket } = require('./ws');
const Order = require('./models/order');
const { OrderStatus } = require('./models/order');
require('./models/orderResponse');
require('./models/orderRouteSearchEvent');
const { startOrderLifecycleScheduler } = require('./services/orderLifecycleScheduler');
const { getLifecycleCutoffDate } = require('./utils/orderLifecycle');
const { Op } = require('sequelize');

const PORT = process.env.NODE_ENV === 'production'
    ? Number(process.env.PORT_PROD ?? 3000)
    : Number(process.env.PORT ?? 3000)


dotenv.config({ path: '.env' });

const app = express();
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/finance', financialRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/saved-searches', savedSearchRoutes);
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
    const server = http.createServer(app);
    setupWebSocket(server);
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    scheduleCleanup();
    startOrderLifecycleScheduler();
  } catch (err) {
    console.error('Failed to start server', err);
  }
}

start();
