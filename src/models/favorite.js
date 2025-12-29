const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');
const User = require('./user');

class Favorite extends Model {}

Favorite.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    driverId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  },
  { sequelize: db, modelName: 'favorite' }
);

User.belongsToMany(User, {
  through: Favorite,
  as: 'favoriteDrivers',
  foreignKey: 'customerId',
  otherKey: 'driverId',
});

module.exports = Favorite;
