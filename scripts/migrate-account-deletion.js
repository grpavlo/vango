const { Sequelize } = require('sequelize');
const db = require('../src/config/db');
const migration = require('../src/migrations/20261111000000-account-deletion');
(async () => {
  try {
    if (process.argv[2] !== 'up') throw new Error('Usage: node scripts/migrate-account-deletion.js up');
    await migration.up(db.getQueryInterface(), Sequelize);
    console.log('Account deletion migration applied');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await db.close(); }
})();
