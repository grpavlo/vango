const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');
const User = require('./user');

const OrderStatus = {
  CREATED: 'CREATED',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  PENDING: 'PENDING',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
};

class Order extends Model {}

Order.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    driverId: { type: DataTypes.INTEGER.UNSIGNED },
    pickupLocation: { type: DataTypes.STRING, allowNull: false },
    dropoffLocation: { type: DataTypes.STRING, allowNull: false },
    pickupCountry: { type: DataTypes.STRING },
    pickupCity: { type: DataTypes.STRING },
    pickupAddress: { type: DataTypes.STRING },
    pickupPostcode: { type: DataTypes.STRING },
    dropoffCountry: { type: DataTypes.STRING },
    dropoffCity: { type: DataTypes.STRING },
    dropoffAddress: { type: DataTypes.STRING },
    dropoffPostcode: { type: DataTypes.STRING },
    cargoType: { type: DataTypes.STRING, allowNull: false },
    pickupLat: { type: DataTypes.FLOAT },
    pickupLon: { type: DataTypes.FLOAT },
    dropoffLat: { type: DataTypes.FLOAT },
    dropoffLon: { type: DataTypes.FLOAT },
    loadHelp: { type: DataTypes.BOOLEAN, defaultValue: false },
    unloadHelp: { type: DataTypes.BOOLEAN, defaultValue: false },
    payment: { type: DataTypes.ENUM('cash', 'card'), defaultValue: 'cash' },
    loadFrom: { type: DataTypes.DATE, allowNull: false },
    loadTo: { type: DataTypes.DATE, allowNull: false },
    unloadFrom: { type: DataTypes.DATE, allowNull: false },
    unloadTo: { type: DataTypes.DATE, allowNull: false },
    insurance: { type: DataTypes.BOOLEAN, defaultValue: false },
    status: { type: DataTypes.ENUM(...Object.values(OrderStatus)), defaultValue: OrderStatus.CREATED },
    systemPrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    price: { type: DataTypes.FLOAT, allowNull: false },
    agreedPrice: { type: DataTypes.BOOLEAN, defaultValue: false },
    finalPrice: { type: DataTypes.FLOAT },
    reservedBy: { type: DataTypes.INTEGER.UNSIGNED },
    reservedUntil: { type: DataTypes.DATE },
    candidateDriverId: { type: DataTypes.INTEGER.UNSIGNED },
    candidateUntil: { type: DataTypes.DATE },
    photos: { type: DataTypes.JSON },
    history: { type: DataTypes.JSON, defaultValue: [] },
  },
  { sequelize: db, modelName: 'order' }
);

User.hasMany(Order, { foreignKey: 'customerId', as: 'customerOrders' });
Order.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });

User.hasMany(Order, { foreignKey: 'driverId', as: 'driverOrders' });
Order.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });

User.hasMany(Order, { foreignKey: 'reservedBy', as: 'reservedOrders' });
Order.belongsTo(User, { foreignKey: 'reservedBy', as: 'reservedDriver' });

User.hasMany(Order, { foreignKey: 'candidateDriverId', as: 'candidateOrders' });
Order.belongsTo(User, { foreignKey: 'candidateDriverId', as: 'candidateDriver' });

module.exports = Order;
module.exports.OrderStatus = OrderStatus;
