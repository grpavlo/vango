const { initDb } = require('./config/db');
const User = require('./models/user');

const db = initDb();
const userModel = new User(db);

async function seed() {
  try {
    const admin = await userModel.findByUsername('admin');
    if (!admin) {
      await userModel.create('admin', 'admin123', 'superuser');
      console.log('Superuser created');
    } else {
      console.log('Superuser already exists');
    }
    db.close();
  } catch (err) {
    console.error('Seeding error', err);
    db.close();
  }
}

seed();
