const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');
const User = require('./user');
const Order = require('./order');

const ResponseStatus = {
  RESPONDED: 'RESPONDED',
  CALL_MADE: 'CALL_MADE',
  PENDING_CONFIRM: 'PENDING_CONFIRM',
  DISCUSSING: 'DISCUSSING',
  CONFIRMED: 'CONFIRMED',
  DECLINED: 'DECLINED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
};

class OrderResponse extends Model {}

OrderResponse.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    driverId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    status: {
      type: DataTypes.ENUM(...Object.values(ResponseStatus)),
      defaultValue: ResponseStatus.RESPONDED,
    },
    respondedAt: { type: DataTypes.DATE },
    callMadeAt: { type: DataTypes.DATE },
    resultSubmittedAt: { type: DataTypes.DATE },
    confirmedAt: { type: DataTypes.DATE },
    expiresAt: { type: DataTypes.DATE },
  },
  { sequelize: db, modelName: 'orderResponse' }
);

Order.hasMany(OrderResponse, { foreignKey: 'orderId', as: 'responses' });
OrderResponse.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

User.hasMany(OrderResponse, { foreignKey: 'driverId', as: 'orderResponses' });
OrderResponse.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });

module.exports = OrderResponse;
module.exports.ResponseStatus = ResponseStatus;
