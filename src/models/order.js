const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');
const User = require('./user');

const OrderStatus = {
  CREATED: 'CREATED',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
};

class Order extends Model {}

Order.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    driverId: { type: DataTypes.INTEGER.UNSIGNED },
    pickupLocation: { type: DataTypes.STRING, allowNull: false },
    dropoffLocation: { type: DataTypes.STRING, allowNull: false },
    cargoType: { type: DataTypes.STRING, allowNull: false },
    dimensions: { type: DataTypes.STRING, allowNull: false },
    weight: { type: DataTypes.FLOAT, allowNull: false },
    loadFrom: { type: DataTypes.DATE, allowNull: false },
    loadTo: { type: DataTypes.DATE, allowNull: false },
    unloadFrom: { type: DataTypes.DATE, allowNull: false },
    unloadTo: { type: DataTypes.DATE, allowNull: false },
    insurance: { type: DataTypes.BOOLEAN, defaultValue: false },
    status: { type: DataTypes.ENUM(...Object.values(OrderStatus)), defaultValue: OrderStatus.CREATED },
    systemPrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    price: { type: DataTypes.FLOAT, allowNull: false },
    photos: { type: DataTypes.JSON },
    city: { type: DataTypes.STRING },
  },
  { sequelize: db, modelName: 'order' }
);

User.hasMany(Order, { foreignKey: 'customerId', as: 'customerOrders' });
Order.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });

User.hasMany(Order, { foreignKey: 'driverId', as: 'driverOrders' });
Order.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });

module.exports = Order;
module.exports.OrderStatus = OrderStatus;
