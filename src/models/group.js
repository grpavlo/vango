const { DataTypes, Model } = require("sequelize");
const db = require("../config/db");

class Group extends Model {}

Group.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    photo: { type: DataTypes.STRING },
  },
  {
    sequelize: db,
    modelName: "group",
  }
);

module.exports = Group;
