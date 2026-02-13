require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

module.exports = {
  development: {
    use_env_variable: 'DATABASE_URL', // бере з .env
    dialect: 'postgres',
    logging: false,
    // якщо у тебе SSL на проді — додаси тут dialectOptions.ssl
  },
  test: {
    url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    logging: false,
  },
};