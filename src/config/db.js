const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const databaseUrl = process.env.NODE_ENV === 'production'
    ? process.env.DATABASE_URL_PROD
    : process.env.DATABASE_URL



const db = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
});

module.exports = db;
