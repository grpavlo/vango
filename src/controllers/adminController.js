const User = require('../models/user');
const { setServiceFee } = require('../config');
const Order = require('../models/order');

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

module.exports = { listUsers, blockDriver, unblockDriver, updateServiceFee, analytics };
