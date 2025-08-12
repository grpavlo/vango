const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.ADMIN_DB_URL ||
    'postgres://postgres:postgres@localhost:5432/backend_frontend'
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

