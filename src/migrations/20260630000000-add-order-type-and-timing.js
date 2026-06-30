module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("orders");

    if (!table.requestedOrderType) {
      await queryInterface.addColumn("orders", "requestedOrderType", {
        type: Sequelize.ENUM("LOCAL", "LONG_DISTANCE"),
        allowNull: true,
      });
    }

    if (!table.timingOption) {
      await queryInterface.addColumn("orders", "timingOption", {
        type: Sequelize.ENUM("ASAP", "WITHIN_1_HOUR", "SCHEDULED"),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("orders");

    if (table.timingOption) {
      await queryInterface.removeColumn("orders", "timingOption");
    }

    if (table.requestedOrderType) {
      await queryInterface.removeColumn("orders", "requestedOrderType");
    }

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_timingOption";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_requestedOrderType";');
  },
};
