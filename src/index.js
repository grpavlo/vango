const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const financialRoutes = require('./routes/financialRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const { setupWebSocket } = require('./ws');
const Order = require('./models/order');
const { Op } = require('sequelize');

dotenv.config();

// Generate a shared admin secret on startup if one isn't provided
if (!process.env.ADMIN_SECRET) {
  process.env.ADMIN_SECRET = crypto.randomBytes(32).toString('hex');
}

const app = express();
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/finance', financialRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/favorites', favoriteRoutes);

const PORT = process.env.PORT || 3000;

function scheduleCleanup() {
  async function cleanup() {
    const cutoff = new Date();
    // Set to the start of the current day
    cutoff.setHours(0, 0, 0, 0);
    // Delete orders where load date is before today
    await Order.destroy({ where: { loadFrom: { [Op.lt]: cutoff } } });
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
  } catch (err) {
    console.error('Failed to start server', err);
  }
}

start();
