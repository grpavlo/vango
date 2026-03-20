const { DataTypes, Model } = require("sequelize");
const db = require("../config/db");
const Order = require("./order");
const User = require("./user");

class OrderRouteSearchEvent extends Model {}

OrderRouteSearchEvent.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    driverId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    dayKey: { type: DataTypes.STRING(10), allowNull: false }, // YYYY-MM-DD
  },
  {
    sequelize: db,
    modelName: "orderRouteSearchEvent",
    indexes: [
      {
        unique: true,
        fields: ["orderId", "driverId", "dayKey"],
      },
      {
        fields: ["orderId", "dayKey"],
      },
    ],
  }
);

Order.hasMany(OrderRouteSearchEvent, { foreignKey: "orderId", as: "routeSearchEvents" });
OrderRouteSearchEvent.belongsTo(Order, { foreignKey: "orderId", as: "order" });

User.hasMany(OrderRouteSearchEvent, { foreignKey: "driverId", as: "routeSearchEvents" });
OrderRouteSearchEvent.belongsTo(User, { foreignKey: "driverId", as: "driver" });

module.exports = OrderRouteSearchEvent;
