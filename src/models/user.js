const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');

const UserRole = {
  DRIVER: 'DRIVER',
  CUSTOMER: 'CUSTOMER',
  ADMIN: 'ADMIN',
  BOTH: 'BOTH',
};

class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      allowNull: false,
      defaultValue: UserRole.BOTH,
    },
    rating: { type: DataTypes.FLOAT, defaultValue: 5 },
    blocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    city: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    firstName: { type: DataTypes.STRING },
    lastName: { type: DataTypes.STRING },
    patronymic: { type: DataTypes.STRING },
    selfiePhoto: { type: DataTypes.STRING },
    pushToken: { type: DataTypes.STRING },
    pushConsent: { type: DataTypes.BOOLEAN, defaultValue: false },
    balance: { type: DataTypes.FLOAT, defaultValue: 0 },
  },
  {
    sequelize: db,
    modelName: 'user',
  }
);

module.exports = User;
module.exports.UserRole = UserRole;
