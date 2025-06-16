const Order = require('../models/order');
const Transaction = require('../models/transaction');
const { SERVICE_FEE_PERCENT } = require('../config');

async function createOrder(req, res) {
  const { pickupLocation, dropoffLocation, cargoType, dimensions, weight, timeWindow, insurance, price, city } = req.body;
  console.log(pickupLocation)
  try {
    const order = await Order.create({
      customerId: req.user.id,
      pickupLocation,
      dropoffLocation,
      cargoType,
      dimensions,
      weight,
      timeWindow,
      insurance,
      price,
      city,
    });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: 'Order creation failed', error: err });
  }
}

async function listAvailableOrders(req, res) {
  const city = req.query.city;
  const where = { status: 'CREATED' };
  if (city) where.city = city;
  const orders = await Order.findAll({ where });
  const takenOrders = await Order.findAll({ where: { status: 'ACCEPTED' }, limit: Math.floor(orders.length / 15) });
  res.json({ available: orders, taken: takenOrders });
}

async function listMyOrders(req, res) {
  const where = {};
  if (req.user.role === 'CUSTOMER') {
    where.customerId = req.user.id;
  } else if (req.user.role === 'DRIVER') {
    where.driverId = req.user.id;
  }
  const orders = await Order.findAll({ where });
  res.json(orders);
}

async function acceptOrder(req, res) {
  const orderId = req.params.id;
  try {
    const order = await Order.findByPk(orderId);
    if (!order || order.status !== 'CREATED') {
      res.status(400).json({ message: 'Order not available' });
      return;
    }
    order.driverId = req.user.id;
    order.status = 'ACCEPTED';
    await order.save();
    const serviceFee = (order.price * SERVICE_FEE_PERCENT) / 100;
    await Transaction.create({ orderId: order.id, driverId: req.user.id, amount: order.price, serviceFee });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: 'Accept failed', error: err });
  }
}

async function updateStatus(req, res) {
  const orderId = req.params.id;
  const { status } = req.body;
  try {
    const order = await Order.findByPk(orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    order.status = status;
    await order.save();
    if (status === 'DELIVERED') {
      const tx = await Transaction.findOne({ where: { orderId: order.id } });
      if (tx && tx.status === 'PENDING') {
        tx.status = 'RELEASED';
        await tx.save();
        const amount = tx.amount - tx.serviceFee;
        if (order.driverId) {
          const driver = req.user;
          if (driver) {
            driver.balance += amount;
            await driver.save();
          }
        }
      }
    }
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: 'Update failed', error: err });
  }
}

module.exports = { createOrder, listAvailableOrders, acceptOrder, updateStatus, listMyOrders };
