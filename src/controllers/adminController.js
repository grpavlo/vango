const User = require('../models/user');
const { setServiceFee } = require('../config');
const Order = require('../models/order');
const { Op, fn, col } = require('sequelize');
const { sendNotification } = require('../utils/notification');
const moment = require('moment-timezone');

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

  const clickWhere = {};
  if (city) clickWhere.pickupCity = city;

  const orderWhere = {};
  if (start || end) {
    const tz = 'America/New_York';
    orderWhere.createdAt = {};
    if (start) orderWhere.createdAt[Op.gte] = moment.tz(start, tz).toDate();
    if (end) orderWhere.createdAt[Op.lte] = moment.tz(end, tz).toDate();
  }

  // clicks filtered by city, orders filtered only by NY time range

  const [clicks, orders] = await Promise.all([
    Order.count({ where: clickWhere }),
    Order.count({ where: orderWhere }),
  ]);

  res.json({ clicks, orders, display: `${clicks} (${orders})` });
}

async function sendPush(req, res) {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });
  const users = await User.findAll({ where: { pushToken: { [Op.not]: null } } });
  await Promise.all(users.map((u) => sendNotification(u.id, message)));
  res.json({ sent: users.length });
}

module.exports = { listUsers, blockDriver, unblockDriver, updateServiceFee, analytics, pickupAddressReport, sendPush };
