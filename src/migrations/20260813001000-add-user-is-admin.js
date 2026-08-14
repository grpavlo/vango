"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("users");

    if (!table.isAdmin) {
      await queryInterface.addColumn("users", "isAdmin", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE "users"
      SET "isAdmin" = true,
          "role" = CASE WHEN "role" = 'ADMIN' THEN 'BOTH' ELSE "role" END
      WHERE regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g') IN ('0979386433', '380979386433');
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("users");

    if (table.isAdmin) {
      await queryInterface.removeColumn("users", "isAdmin");
    }
  },
};
