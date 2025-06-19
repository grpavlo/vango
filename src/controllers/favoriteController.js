const Favorite = require('../models/favorite');
const User = require('../models/user');

async function addFavorite(req, res) {
  const driverId = req.params.driverId;
  try {
    const driver = await User.findByPk(driverId);
    if (!driver || (driver.role !== 'DRIVER' && driver.role !== 'BOTH')) {
      return res.status(404).json({ message: 'Водія не знайдено' });
    }
    await Favorite.findOrCreate({ where: { customerId: req.user.id, driverId } });
    res.json({ message: 'Додано до улюблених' });
  } catch (err) {
    res.status(400).json({ message: 'Не вдалося додати в улюблені', error: err });
  }
}

async function removeFavorite(req, res) {
  const driverId = req.params.driverId;
  try {
    await Favorite.destroy({ where: { customerId: req.user.id, driverId } });
    res.json({ message: 'Видалено з улюблених' });
  } catch (err) {
    res.status(400).json({ message: 'Не вдалося видалити з улюблених', error: err });
  }
}

async function listFavorites(req, res) {
  const favorites = await Favorite.findAll({ where: { customerId: req.user.id } });
  res.json(favorites);
}

module.exports = { addFavorite, removeFavorite, listFavorites };
