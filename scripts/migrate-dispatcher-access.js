'use strict';

const direction = process.argv[2] || 'up';
if (direction === '--help') {
  console.log('Usage: node scripts/migrate-dispatcher-access.js [up|down]');
  process.exit(0);
}
if (!['up', 'down'].includes(direction)) {
  console.error('Expected up or down');
  process.exit(1);
}
const { Sequelize } = require('sequelize');
const db = require('../src/config/db');
const migration = require('../src/migrations/20261007000000-add-dispatcher-access');
(async () => {
  try {
    await migration[direction](db.getQueryInterface(), Sequelize);
    console.log(`Dispatcher access migration: ${direction}`);
  } catch {
    console.error('Dispatcher access migration failed; check database availability and schema permissions.');
    process.exitCode = 1;
  } finally { await db.close(); }
})();
