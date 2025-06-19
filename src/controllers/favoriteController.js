const Favorite = require('../models/favorite');
const User = require('../models/user');

async function addFavorite(req, res) {
  const driverId = req.params.driverId;
  try {
    const driver = await User.findByPk(driverId);
    if (!driver || (driver.role !== 'DRIVER' && driver.role !== 'BOTH')) {
      return res.status(404).json({ message: 'Driver not found' });
    }
    await Favorite.findOrCreate({ where: { customerId: req.user.id, driverId } });
    res.json({ message: 'Added to favorites' });
  } catch (err) {
    res.status(400).json({ message: 'Failed to add favorite', error: err });
  }
}

async function removeFavorite(req, res) {
  const driverId = req.params.driverId;
  try {
    await Favorite.destroy({ where: { customerId: req.user.id, driverId } });
    res.json({ message: 'Removed from favorites' });
  } catch (err) {
    res.status(400).json({ message: 'Failed to remove favorite', error: err });
  }
}

async function listFavorites(req, res) {
  const favorites = await Favorite.findAll({ where: { customerId: req.user.id } });
  res.json(favorites);
}

module.exports = { addFavorite, removeFavorite, listFavorites };
