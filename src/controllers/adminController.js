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
  const { start, end, city, idManager } = req.query;

  console.log('pickupAddressReport params', req.query);

  const clickWhere = {};
  if (city) clickWhere.pickupCity = city;

  const orderWhere = {};
  if (idManager) orderWhere.idManager = idManager;
  if (start || end) {
    const tz = 'America/New_York';
    const from = moment.tz(start || end, tz).startOf('day');
    const to = moment.tz(end || start, tz).endOf('day');
    orderWhere.createdAt = { [Op.between]: [from.toDate(), to.toDate()] };
  }

  console.log('pickupAddressReport filters', { clickWhere, orderWhere });


  const [clicks, stats] = await Promise.all([
    Order.count({
      where: clickWhere,
      logging: (sql) => console.log('pickupAddressReport SQL clicks', sql),
    }),
    Order.findOne({
      attributes: [
        [fn('COUNT', col('*')), 'count'],
        [fn('MAX', col('createdAt')), 'lastCreated'],
      ],
      where: orderWhere,
      raw: true,
      logging: (sql) => console.log('pickupAddressReport SQL orders', sql),
    }),


  ]);

  console.log('pickupAddressReport stats', { clicks, stats });

  const orders = Number(stats?.count || 0);
  const lastCreated = stats?.lastCreated || null;

  res.json({ clicks, orders, lastCreated, display: `${clicks} (${orders})` });
}

async function sendPush(req, res) {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });
  const users = await User.findAll({ where: { pushToken: { [Op.not]: null } } });
  await Promise.all(users.map((u) => sendNotification(u.id, message)));
  res.json({ sent: users.length });
}

module.exports = { listUsers, blockDriver, unblockDriver, updateServiceFee, analytics, pickupAddressReport, sendPush };
