'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.isDispatcher) await queryInterface.addColumn('users', 'isDispatcher', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
  },
  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (table.isDispatcher) await queryInterface.removeColumn('users', 'isDispatcher');
  },
};
