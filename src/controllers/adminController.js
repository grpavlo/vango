const User = require('../models/user');
const { setServiceFee } = require('../config');
const Order = require('../models/order');
const { Op, fn, col } = require('sequelize');
const { sendNotification } = require('../utils/notification');

async function listUsers(_req, res) {
  const users = await User.findAll();
  res.json(users);
}

async function blockDriver(req, res) {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user || (user.role !== 'DRIVER' && user.role !== 'BOTH')) {
    res.status(404).send('Водія не знайдено');

    return;
  }
  user.blocked = true;
  await user.save();
  res.json(user);
}

async function unblockDriver(req, res) {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user || (user.role !== 'DRIVER' && user.role !== 'BOTH')) {
    res.status(404).send('Водія не знайдено');

    return;
  }
  user.blocked = false;
  await user.save();
  res.json(user);
}

async function updateServiceFee(req, res) {
  const { percent } = req.body;
  setServiceFee(percent);
  res.json({ percent });
}

async function analytics(_req, res) {
  const avgPrice = (await Order.sum('price')) / (await Order.count());
  const deliveredOrders = await Order.findAll({ where: { status: 'DELIVERED' } });
  const avgTime = deliveredOrders.length;
  res.json({ avgPrice, deliveredCount: deliveredOrders.length, avgTime });
}

async function pickupAddressReport(req, res) {
  const { start, end, city } = req.query;
  const where = {};
  if (city) where.pickupCity = city;
  if (start || end) {
    where.createdAt = {};
    if (start) where.createdAt[Op.gte] = new Date(start);
    if (end) where.createdAt[Op.lte] = new Date(end);
  }
  const rows = await Order.findAll({
    where,
    attributes: ['pickupAddress', [fn('COUNT', col('id')), 'orderCount']],
    group: ['pickupAddress'],
  });
  const report = rows.map((row) => {
    const count = parseInt(row.get('orderCount'), 10);
    return {
      pickupAddress: row.pickupAddress,
      clicks: count,
      orders: count,
      display: `${count} (${count})`,
    };
  });
  res.json(report);
}

async function sendPush(req, res) {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });
  const users = await User.findAll({ where: { pushToken: { [Op.not]: null } } });
  await Promise.all(users.map((u) => sendNotification(u.id, message)));
  res.json({ sent: users.length });
}

module.exports = { listUsers, blockDriver, unblockDriver, updateServiceFee, analytics, pickupAddressReport, sendPush };
