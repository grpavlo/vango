"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("DriverProfiles", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },

      fullName: { type: Sequelize.STRING },
      noInn: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      inn: { type: Sequelize.STRING },
      innDocPhoto: { type: Sequelize.STRING },

      passportSeries: { type: Sequelize.STRING },
      passportNumber: { type: Sequelize.STRING },
      passportPhotoMain: { type: Sequelize.STRING },
      passportPhotoRegistration: { type: Sequelize.STRING },

      driverLicenseSeries: { type: Sequelize.STRING },
      driverLicenseNumber: { type: Sequelize.STRING },
      driverLicensePhoto: { type: Sequelize.STRING },

      vehicleTechSeries: { type: Sequelize.STRING },
      vehicleTechNumber: { type: Sequelize.STRING },
      vehicleTechPhoto: { type: Sequelize.STRING },

      carMake: { type: Sequelize.STRING },
      carModel: { type: Sequelize.STRING },
      carYear: { type: Sequelize.INTEGER },
      carPlate: { type: Sequelize.STRING },
      carLengthMm: { type: Sequelize.INTEGER },
      carWidthMm: { type: Sequelize.INTEGER },
      carHeightMm: { type: Sequelize.INTEGER },

      carPhotoFrontRight: { type: Sequelize.STRING },
      carPhotoRearLeft: { type: Sequelize.STRING },
      carPhotoInterior: { type: Sequelize.STRING },
      selfiePhoto: { type: Sequelize.STRING },

      // status: {
      //   type: Sequelize.ENUM("DRAFT", "SUBMITTED", "APPROVED", "REJECTED"),
      //   defaultValue: "DRAFT",
      //   allowNull: false,
      // },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });

    await queryInterface.addIndex("DriverProfiles", ["userId"]);
    await queryInterface.addIndex("DriverProfiles", ["carPlate"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("DriverProfiles", ["userId"]);
    await queryInterface.removeIndex("DriverProfiles", ["carPlate"]);
    await queryInterface.dropTable("DriverProfiles");
  },
};
