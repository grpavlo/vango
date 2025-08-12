const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '1',
  host: 'localhost',
  port: 5432,
  database: 'backend-frontend'
});


async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  )`);
  return pool;
}

module.exports = { initDb };

