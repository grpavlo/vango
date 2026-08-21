"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("supportQuestions");
    if (!table.photos) {
      await queryInterface.addColumn("supportQuestions", "photos", {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("supportQuestions");
    if (table.photos) {
      await queryInterface.removeColumn("supportQuestions", "photos");
    }
  },
};
