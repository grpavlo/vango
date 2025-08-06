const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');
const User = require('./user');

class Session extends Model {}

Session.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    token: { type: DataTypes.STRING, allowNull: false },
    ip: { type: DataTypes.STRING },
    browser: { type: DataTypes.STRING },
    device: { type: DataTypes.STRING },
  },
  {
    sequelize: db,
    modelName: 'session',
  }
);

User.hasMany(Session, { foreignKey: 'userId', onDelete: 'CASCADE' });
Session.belongsTo(User, { foreignKey: 'userId' });

module.exports = Session;
