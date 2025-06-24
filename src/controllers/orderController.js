const Order = require('../models/order');
const Transaction = require('../models/transaction');
const { SERVICE_FEE_PERCENT } = require('../config');
const { broadcastOrder, broadcastDelete } = require('../ws');

async function createOrder(req, res) {
  const {
    pickupLocation,
    dropoffLocation,
    pickupCountry,
    pickupCity,
    pickupAddress,
    pickupPostcode,
    dropoffCountry,
    dropoffCity,
    dropoffAddress,
    dropoffPostcode,
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
    volWeight,
    loadHelp,
    unloadHelp,
    payment,
    insurance,
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
      pickupCountry,
      pickupCity,
      pickupAddress,
      pickupPostcode,
      dropoffCountry,
      dropoffCity,
      dropoffAddress,
      dropoffPostcode,
      cargoType,
      dimensions,
      weight,
      volWeight,
      pickupLat,
      pickupLon,
      dropoffLat,
      dropoffLon,
      loadHelp: loadHelp === 'true' || loadHelp === true,
      unloadHelp: unloadHelp === 'true' || unloadHelp === true,
      payment,
      loadFrom,
      loadTo,
      unloadFrom,
      unloadTo,
      insurance,
      systemPrice,
      price,
      photos: req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [],
    });
    broadcastOrder(order);
    res.json(order);
  } catch (err) {
    res.status(400).send('Не вдалося створити замовлення');

  }
}

async function listAvailableOrders(req, res) {
  const { city, pickupCity, dropoffCity, date, minVolume, maxVolume, minWeight, maxWeight } = req.query;
  const { Op } = require('sequelize');

  const where = { status: 'CREATED' };
  const cityFilter = pickupCity || city;
  if (cityFilter) where.pickupCity = cityFilter;
  if (dropoffCity) where.dropoffCity = dropoffCity;

  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    where.loadFrom = { [Op.gte]: start };
    where.loadTo = { [Op.lt]: end };
  }

  if (minWeight || maxWeight) {
    where.weight = {};
    if (minWeight) where.weight[Op.gte] = parseFloat(minWeight);
    if (maxWeight) where.weight[Op.lte] = parseFloat(maxWeight);
  }

  const now = new Date();
  where[Op.or] = [
    { reservedBy: null },
    { reservedUntil: { [Op.lt]: now } },
    { reservedBy: req.user.id },
  ];
  const orders = await Order.findAll({ where });

  function calcVolume(dimensions) {
    if (!dimensions) return null;
    const parts = dimensions.split('x').map((n) => parseFloat(n));
    if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;
    return parts[0] * parts[1] * parts[2];
  }

  const filtered = orders.filter((o) => {
    const vol = calcVolume(o.dimensions);
    if (minVolume && vol !== null && vol < parseFloat(minVolume)) return false;
    if (maxVolume && vol !== null && vol > parseFloat(maxVolume)) return false;
    return true;
  });

  const takenOrders = await Order.findAll({
    where: { status: 'ACCEPTED' },
    limit: Math.floor(filtered.length / 15),
  });
  res.json({ available: filtered, taken: takenOrders });
}

async function listMyOrders(req, res) {
  const { Op } = require('sequelize');
  const role = req.query.role || req.user.role;
  const now = new Date();
  let where = {};
  if (role === 'CUSTOMER') {
    where.customerId = req.user.id;
  } else if (role === 'DRIVER') {
    where = {
      [Op.or]: [
        { driverId: req.user.id },
        { reservedBy: req.user.id, reservedUntil: { [Op.gt]: now } },
      ],
    };
  } else if (role === 'BOTH' || !role) {
    where = {
      [Op.or]: [
        { customerId: req.user.id },
        { driverId: req.user.id },
        { reservedBy: req.user.id, reservedUntil: { [Op.gt]: now } },
      ],
    };
  }
  const orders = await Order.findAll({ where });
  res.json(orders);
}

async function reserveOrder(req, res) {
  const orderId = req.params.id;
  try {
    const order = await Order.findByPk(orderId, { include: { model: require('../models/user'), as: 'customer' } });
    if (!order || order.status !== 'CREATED') {
      return res.status(400).send('Замовлення недоступне');
    }
    const now = new Date();
    if (order.reservedBy && order.reservedUntil && order.reservedUntil > now && order.reservedBy !== req.user.id) {
      return res.status(400).send('Вже зарезервовано');
    }
    order.reservedBy = req.user.id;
    order.reservedUntil = new Date(now.getTime() + 10 * 60000);
    await order.save();
    broadcastOrder(order);
    res.json({ order, phone: order.customer ? order.customer.phone : null });
  } catch (err) {
    res.status(400).send('Не вдалося зарезервувати');
  }
}

async function cancelReserve(req, res) {
  const orderId = req.params.id;
  try {
    const order = await Order.findByPk(orderId);
    if (!order || order.reservedBy !== req.user.id) {
      return res.status(400).send('Немає резерву');
    }
    order.reservedBy = null;
    order.reservedUntil = null;
    await order.save();
    broadcastOrder(order);
    res.json(order);
  } catch (err) {
    res.status(400).send('Не вдалося зняти резерв');
  }
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
    broadcastOrder(order);
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

async function updateOrder(req, res) {
  const id = req.params.id;
  try {
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).send('Замовлення не знайдено');
    }
    if (order.customerId !== req.user.id || order.status !== 'CREATED') {
      return res.status(400).send('Неможливо редагувати');
    }
    const fields = [
      'pickupLocation',
      'dropoffLocation',
      'pickupCountry',
      'pickupCity',
      'pickupAddress',
      'pickupPostcode',
      'dropoffCountry',
      'dropoffCity',
      'dropoffAddress',
      'dropoffPostcode',
      'cargoType',
      'dimensions',
      'weight',
      'volWeight',
      'pickupLat',
      'pickupLon',
      'dropoffLat',
      'dropoffLon',
      'loadHelp',
      'unloadHelp',
      'payment',
      'loadFrom',
      'loadTo',
      'unloadFrom',
      'unloadTo',
      'insurance',
      'price',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        order[f] = req.body[f];
      }
    });
    if (
      req.body.pickupLat &&
      req.body.pickupLon &&
      req.body.dropoffLat &&
      req.body.dropoffLon
    ) {
      try {
        const resRoute = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${req.body.dropoffLon},${req.body.dropoffLat};${req.body.pickupLon},${req.body.pickupLat}?overview=false`
        );
        const data = await resRoute.json();
        if (data.routes && data.routes[0]) {
          const km = data.routes[0].distance / 1000;
          order.systemPrice = km * 50;
          if (req.body.price === undefined) {
            order.price = order.systemPrice;
          }
        }
      } catch (err) {
        console.log(err);
      }
    }
    if (req.files && req.files.length > 0) {
      const uploaded = req.files.map((f) => `/uploads/${f.filename}`);
      order.photos = [...(order.photos || []), ...uploaded];
    }
    await order.save();
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
    broadcastDelete(order.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).send('Помилка видалення');
  }
}

module.exports = {
  createOrder,
  listAvailableOrders,
  reserveOrder,
  cancelReserve,
  acceptOrder,
  updateStatus,
  listMyOrders,
  updateOrder,
  deleteOrder,
};
