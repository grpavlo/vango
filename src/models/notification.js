const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');
const User = require('./user');

class Notification extends Model {}

Notification.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    body: { type: DataTypes.TEXT, defaultValue: '' },
    data: { type: DataTypes.JSON, defaultValue: {} },
    read: { type: DataTypes.BOOLEAN, defaultValue: false },
    receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize: db, modelName: 'notification' }
);

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = Notification;
