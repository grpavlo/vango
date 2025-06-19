const Order = require('../models/order');
const Transaction = require('../models/transaction');
const { SERVICE_FEE_PERCENT } = require('../config');

async function createOrder(req, res) {
  const {
    pickupLocation,
    dropoffLocation,
    cargoType,
    dimensions,
    weight,
    loadFrom,
    loadTo,
    unloadFrom,
    unloadTo,
    pickupLat,
    pickupLon,
    dropoffLat,
    dropoffLon,
    insurance,
    city,
  } = req.body;
  let systemPrice = 0;
  let price = 0;
  try {
    if (pickupLat && pickupLon && dropoffLat && dropoffLon) {
      const resRoute = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${pickupLon},${pickupLat};${dropoffLon},${dropoffLat}?overview=false`
      );
      const data = await resRoute.json();
      if (data.routes && data.routes[0]) {
        const km = data.routes[0].distance / 1000;
        systemPrice = km * 50;
        price = parseFloat(req.body.price || systemPrice);
      }
    }
    const order = await Order.create({
      customerId: req.user.id,
      pickupLocation,
      dropoffLocation,
      cargoType,
      dimensions,
      weight,
      loadFrom,
      loadTo,
      unloadFrom,
      unloadTo,
      insurance,
      systemPrice,
      price,
      city,
      photos: req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [],
    });
    res.json(order);
  } catch (err) {
    res.status(400).send('Не вдалося створити замовлення');

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
  const { Op } = require('sequelize');
  let where = {};
  if (req.user.role === 'CUSTOMER') {
    where.customerId = req.user.id;
  } else if (req.user.role === 'DRIVER') {
    where.driverId = req.user.id;
  } else if (req.user.role === 'BOTH') {
    where = {
      [Op.or]: [{ customerId: req.user.id }, { driverId: req.user.id }],
    };
  }
  const orders = await Order.findAll({ where });
  res.json(orders);
}

async function acceptOrder(req, res) {
  const orderId = req.params.id;
  try {
    const order = await Order.findByPk(orderId);
    if (!order || order.status !== 'CREATED') {
      res.status(400).send('Замовлення недоступне');

      return;
    }
    order.driverId = req.user.id;
    order.status = 'ACCEPTED';
    await order.save();
    const serviceFee = (order.price * SERVICE_FEE_PERCENT) / 100;
    await Transaction.create({ orderId: order.id, driverId: req.user.id, amount: order.price, serviceFee });
    res.json(order);
  } catch (err) {
    res.status(400).send('Не вдалося прийняти замовлення');

  }
}

async function updateStatus(req, res) {
  const orderId = req.params.id;
  const { status } = req.body;
  try {
    const order = await Order.findByPk(orderId);
    if (!order) {
      res.status(404).send('Замовлення не знайдено');

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
    res.status(400).send('Не вдалося оновити замовлення');

  }
}

async function deleteOrder(req, res) {
  const id = req.params.id;
  try {
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).send('Замовлення не знайдено');
    }
    if (order.customerId !== req.user.id || order.status !== 'CREATED') {
      return res.status(400).send('Неможливо видалити');
    }
    await order.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).send('Помилка видалення');
  }
}

module.exports = { createOrder, listAvailableOrders, acceptOrder, updateStatus, listMyOrders, deleteOrder };
