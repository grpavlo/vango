const Rating = require('../models/rating');

async function rateUser(req, res) {
  const { toUserId, orderId, rating, comment } = req.body;
  try {
    const rate = await Rating.create({ orderId, fromUserId: req.user.id, toUserId, rating, comment });
    res.json(rate);
  } catch (err) {
    res.status(400).send('Rating failed');
  }
}

module.exports = { rateUser };
