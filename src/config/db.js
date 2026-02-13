const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';
const databaseUrl = isTest
  ? (process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || '')
  : (process.env.DATABASE_URL || '');

const db = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
});

module.exports = db;
