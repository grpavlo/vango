"use strict";
const { Model, DataTypes } = require("sequelize");
const db = require("../config/db");
const User = require("./user"); // 👈 додай це

class DriverProfile extends Model {
  static associate(models) {
    DriverProfile.belongsTo(models.User, { as: "user", foreignKey: "userId" });
  }
}

DriverProfile.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },

    fullName: { type: DataTypes.STRING, allowNull: true },

    noInn: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    inn: { type: DataTypes.STRING, allowNull: true },
    innDocPhoto: { type: DataTypes.STRING, allowNull: true },

    passportSeries: { type: DataTypes.STRING, allowNull: true },
    passportNumber: { type: DataTypes.STRING, allowNull: true },
    passportPhotoMain: { type: DataTypes.STRING, allowNull: true },
    passportPhotoRegistration: { type: DataTypes.STRING, allowNull: true },

    driverLicenseSeries: { type: DataTypes.STRING, allowNull: true },
    driverLicenseNumber: { type: DataTypes.STRING, allowNull: true },
    driverLicensePhoto: { type: DataTypes.STRING, allowNull: true },

    vehicleTechSeries: { type: DataTypes.STRING, allowNull: true },
    vehicleTechNumber: { type: DataTypes.STRING, allowNull: true },
    vehicleTechPhoto: { type: DataTypes.STRING, allowNull: true },

    carMake: { type: DataTypes.STRING, allowNull: true },
    carModel: { type: DataTypes.STRING, allowNull: true },
    carYear: { type: DataTypes.INTEGER, allowNull: true },
    carPlate: { type: DataTypes.STRING, allowNull: true },
    carLengthMm: { type: DataTypes.INTEGER, allowNull: true },
    carWidthMm: { type: DataTypes.INTEGER, allowNull: true },
    carHeightMm: { type: DataTypes.INTEGER, allowNull: true },

    carPhotoFrontRight: { type: DataTypes.STRING, allowNull: true },
    carPhotoRearLeft: { type: DataTypes.STRING, allowNull: true },
    carPhotoInterior: { type: DataTypes.STRING, allowNull: true },
    selfiePhoto: { type: DataTypes.STRING, allowNull: true },

    status: {
      type: DataTypes.ENUM("DRAFT", "SUBMITTED", "APPROVED", "REJECTED"),
      allowNull: false,
      defaultValue: "DRAFT",
    },

    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize: db,
    modelName: "DriverProfile",
  }
);
// 👇 Ось тут робимо зв’язки вручну
User.hasOne(DriverProfile, { as: "driverProfile", foreignKey: "userId" });
DriverProfile.belongsTo(User, { as: "user", foreignKey: "userId" });

module.exports = DriverProfile;
