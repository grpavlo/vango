const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');

const TransactionStatus = {
  PENDING: 'PENDING',
  RELEASED: 'RELEASED',
};

class Transaction extends Model {}

Transaction.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    driverId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    serviceFee: { type: DataTypes.FLOAT, allowNull: false },
    status: { type: DataTypes.ENUM(...Object.values(TransactionStatus)), defaultValue: TransactionStatus.PENDING },
  },
  { sequelize: db, modelName: 'transaction' }
);

module.exports = Transaction;
module.exports.TransactionStatus = TransactionStatus;
