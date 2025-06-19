const db = require('./config/db');
const User = require('./models/user');
const { UserRole } = require('./models/user');
const Order = require('./models/order');

async function seed() {
  await db.sync({ force: true });

  const customer = await User.create({ name: 'Alice', email: 'alice@example.com', password: 'pass', role: UserRole.BOTH, city: 'NYC' });
  const driver = await User.create({ name: 'Bob', email: 'bob@example.com', password: 'pass', role: UserRole.BOTH, city: 'NYC' });
  await User.create({ name: 'Admin', email: 'admin@example.com', password: 'admin', role: UserRole.ADMIN });

  await Order.create({
    customerId: customer.id,
    pickupLocation: 'A',
    dropoffLocation: 'B',
    cargoType: 'Boxes',
    dimensions: '1x1x1',
    weight: 100,
    timeWindow: '9-12',
    insurance: false,
    price: 100,
    city: 'NYC',
  });

  console.log('Seeded');
  process.exit();
}

seed();
