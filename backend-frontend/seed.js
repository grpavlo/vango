const { initDb } = require('./config/db');
const User = require('./models/user');

async function seed() {
  const pool = await initDb();
  const userModel = new User(pool);
  try {
    const admin = await userModel.findByUsername('admin');
    if (!admin) {
      await userModel.create('admin', 'admin123', 'superuser');
      console.log('Superuser created');
    } else {
      console.log('Superuser already exists');
    }
  } catch (err) {
    console.error('Seeding error', err);
  } finally {
    await pool.end();
  }
}

seed();

