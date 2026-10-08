const { Op } = require('sequelize');
const Order = require('../models/order');
const User = require('../models/user');
const OrderResponse = require('../models/orderResponse');
const Rating = require('../models/rating');
const { ownOrderWhere } = require('../utils/dispatcherAccess');
const { buildOrderAnalyticsReport } = require('../services/orderAnalyticsReport');

const userAttributes = ['id', 'name', 'firstName', 'lastName', 'patronymic', 'phone', 'email', 'selfiePhoto'];
const include = ['customer', 'driver', 'candidateDriver', 'reservedDriver'].map((as) => ({ model: User, as, attributes: userAttributes }));
// Only public order fields needed by the customer web cabinet.
const attributes = ['id', 'orderNumber', 'customerId', 'driverId', 'candidateDriverId', 'reservedBy', 'status', 'pickupLocation', 'pickupCity', 'pickupAddress', 'pickupLat', 'pickupLon', 'dropoffLocation', 'dropoffCity', 'dropoffAddress', 'dropoffLat', 'dropoffLon', 'cargoType', 'distance', 'price', 'finalPrice', 'loadFrom', 'loadTo', 'unloadFrom', 'unloadTo', 'freeDate', 'freeDateUntil', 'updatedAt', 'createdAt', 'requestedOrderType', 'isIntraCity', 'timingOption', 'payment', 'agreedPrice', 'cargoLength', 'cargoWidth', 'cargoHeight', 'cargoVolume', 'cargoWeight', 'loadHelp', 'unloadHelp', 'photos', 'history'];
async function serializeOrders(orders) {
  const ids = orders.map((o) => o.id);
  const responses = ids.length ? await OrderResponse.findAll({
    attributes: ['orderId'],
    where: { orderId: { [Op.in]: ids }, status: { [Op.in]: ['RESPONDED', 'CALL_MADE', 'PENDING_CONFIRM', 'DISCUSSING', 'COUNTER_OFFERED'] } }, raw: true,
  }) : [];
  const counts = new Map();
  for (const response of responses) counts.set(Number(response.orderId), (counts.get(Number(response.orderId)) || 0) + 1);
  const ratings = ids.length ? await Rating.findAll({
    attributes: ['id', 'orderId', 'fromUserId', 'toUserId', 'rating', 'comment', 'createdAt'],
    where: { orderId: { [Op.in]: ids } }, order: [['createdAt', 'DESC']], raw: true,
  }) : [];
  return orders.map((model) => {
    const order = model.toJSON();
    const ownRatings = ratings.filter((rating) => Number(rating.orderId) === Number(order.id));
    return {
      ...order, responseCount: counts.get(Number(model.id)) || 0,
      myRating: ownRatings.find((rating) => Number(rating.fromUserId) === Number(order.customerId)) || null,
      receivedRating: ownRatings.find((rating) => Number(rating.toUserId) === Number(order.customerId)) || null,
    };
  });
}
async function listOrders(req, res, next) {
  try {
    if (Object.keys(req.query).length) return res.status(400).send('Непідтримуваний параметр');
    const orders = await Order.findAll({ where: ownOrderWhere(req.user), attributes, include, order: [['createdAt', 'DESC'], ['id', 'DESC']] });
    res.json(await serializeOrders(orders));
  } catch (error) { next(error); }
}
async function getOrder(req, res, next) {
  try {
    const order = await Order.findOne({ where: ownOrderWhere(req.user, req.params.id), attributes, include });
    if (!order) return res.status(404).send('Замовлення не знайдено');
    res.json((await serializeOrders([order]))[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).send(error.message);
    next(error);
  }
}
async function orderReport(req, res, next) {
  try { res.json(await buildOrderAnalyticsReport(req, { customerId: Number(req.user.id) })); }
  catch (error) {
    if (error.status) return res.status(error.status).send(error.message);
    next(error);
  }
}
module.exports = { listOrders, getOrder, orderReport };
