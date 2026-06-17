module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("orders");

    if (!table.orderNumber) {
      await queryInterface.addColumn("orders", "orderNumber", {
        type: Sequelize.INTEGER,
        allowNull: true,
        unique: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE "orders"
      SET "orderNumber" = "id"
      WHERE "orderNumber" IS NULL;
    `);

    const indexes = await queryInterface.showIndex("orders");
    const hasOrderNumberIndex = indexes.some((index) =>
      Array.isArray(index.fields) &&
      index.fields.some((field) => field.attribute === "orderNumber")
    );

    if (!hasOrderNumberIndex) {
      await queryInterface.addIndex("orders", ["orderNumber"], {
        unique: true,
        name: "orders_orderNumber_unique",
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("orders");
    const indexes = await queryInterface.showIndex("orders");
    const hasOrderNumberIndex = indexes.some((index) => index.name === "orders_orderNumber_unique");

    if (hasOrderNumberIndex) {
      await queryInterface.removeIndex("orders", "orders_orderNumber_unique");
    }

    if (table.orderNumber) {
      await queryInterface.removeColumn("orders", "orderNumber");
    }
  },
};
