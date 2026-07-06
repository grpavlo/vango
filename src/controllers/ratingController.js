const { fn, col } = require('sequelize');
const Rating = require('../models/rating');
const Order = require('../models/order');
const User = require('../models/user');
const { sendPush } = require('../utils/push');

function getActorRoleLabel(order, userId) {
  if (order?.driverId === userId) return 'Водій';
  if (order?.customerId === userId) return 'Замовник';
  return 'Користувач';
}

function getOrderDisplayNumber(order) {
  return order?.orderNumber || order?.id;
}

async function rateUser(req, res) {
  const { toUserId, orderId, rating, comment } = req.body;
  try {
    const normalizedRating = Number(rating);
    const normalizedToUserId = Number(toUserId);
    const normalizedOrderId = Number(orderId);

    if (!Number.isInteger(normalizedOrderId) || normalizedOrderId <= 0) {
      return res.status(400).send('Некоректне замовлення');
    }
    if (!Number.isInteger(normalizedToUserId) || normalizedToUserId <= 0) {
      return res.status(400).send('Некоректний користувач');
    }
    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).send('Оберіть оцінку від 1 до 5');
    }
    if (normalizedToUserId === req.user.id) {
      return res.status(400).send('Не можна оцінити себе');
    }

    const order = await Order.findByPk(normalizedOrderId);
    if (!order) return res.status(404).send('Замовлення не знайдено');

    const isParticipant =
      [order.customerId, order.driverId].includes(req.user.id) &&
      [order.customerId, order.driverId].includes(normalizedToUserId);
    if (!isParticipant) {
      return res.status(403).send('Немає прав оцінити цього користувача');
    }
    if (!['DELIVERED', 'COMPLETED'].includes(order.status)) {
      return res.status(400).send('Оцінити можна після виконання замовлення');
    }

    const cleanComment =
      typeof comment === 'string' && comment.trim()
        ? comment.trim().slice(0, 1000)
        : null;

    const [rate, created] = await Rating.findOrCreate({
      where: {
        orderId: normalizedOrderId,
        fromUserId: req.user.id,
        toUserId: normalizedToUserId,
      },
      defaults: {
        rating: normalizedRating,
        comment: cleanComment,
      },
    });

    if (!created) {
      rate.rating = normalizedRating;
      rate.comment = cleanComment;
      await rate.save();
    }

    const aggregate = await Rating.findOne({
      attributes: [[fn('AVG', col('rating')), 'avgRating']],
      where: { toUserId: normalizedToUserId },
      raw: true,
    });
    const avg = Number(aggregate?.avgRating);
    if (Number.isFinite(avg)) {
      await User.update(
        { rating: Math.round(avg * 10) / 10 },
        { where: { id: normalizedToUserId } }
      );
    }

    const toUser = await User.findByPk(normalizedToUserId);
    if (toUser?.pushToken && toUser.pushConsent) {
      const actorLabel = getActorRoleLabel(order, req.user.id);
      const orderDisplayNumber = getOrderDisplayNumber(order);
      sendPush(
        toUser.pushToken,
        `${actorLabel} залишив оцінку за замовлення №${orderDisplayNumber}`,
        `Оцінка: ${normalizedRating}${cleanComment ? '. Є коментар' : ''}`,
        {
          navigateTo: 'ratingDetail',
          ratingId: rate.id,
          orderId: normalizedOrderId,
          orderNumber: orderDisplayNumber,
          rating: normalizedRating,
          comment: cleanComment || '',
          fromUserName: req.user?.name || actorLabel,
          fromRoleLabel: actorLabel,
        }
      );
    }

    res.json(rate);
  } catch (err) {
    res.status(400).send('Не вдалося зберегти оцінку');
  }
}

module.exports = { rateUser };
