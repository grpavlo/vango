const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');
const User = require('./user');
const Order = require('./order');

class Rating extends Model {}

Rating.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    fromUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    toUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    rating: { type: DataTypes.INTEGER, allowNull: false },
    comment: { type: DataTypes.STRING },
  },
  { sequelize: db, modelName: 'rating' }
);

User.hasMany(Rating, { foreignKey: 'fromUserId', as: 'givenRatings' });
User.hasMany(Rating, { foreignKey: 'toUserId', as: 'receivedRatings' });
Rating.belongsTo(User, { foreignKey: 'fromUserId', as: 'fromUser' });
Rating.belongsTo(User, { foreignKey: 'toUserId', as: 'toUser' });
Rating.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

module.exports = Rating;
