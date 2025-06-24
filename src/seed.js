const db = require('./config/db');
const User = require('./models/user');
const { UserRole } = require('./models/user');
const Order = require('./models/order');

async function seed() {
  await db.sync({ force: true });

  const customer = await User.create({ name: 'Alice', email: 'alice@example.com', password: 'pass', role: UserRole.BOTH, city: 'NYC', phone: '380000000001' });
  const driver = await User.create({ name: 'Bob', email: 'bob@example.com', password: 'pass', role: UserRole.BOTH, city: 'NYC', phone: '380000000002' });
  await User.create({ name: 'Admin', email: 'admin@example.com', password: 'admin', role: UserRole.ADMIN, phone: '380000000003' });

  await Order.create({
    customerId: customer.id,
    pickupLocation: 'A',
    dropoffLocation: 'B',
    pickupLat: 40.7128,
    pickupLon: -74.006,
    dropoffLat: 40.73,
    dropoffLon: -74.1,
    pickupCountry: 'USA',
    pickupCity: 'New York',
    pickupAddress: 'A',
    pickupPostcode: '10001',
    dropoffCountry: 'USA',
    dropoffCity: 'New York',
    dropoffAddress: 'B',
    dropoffPostcode: '10002',
    cargoType: 'Boxes',
    dimensions: '1x1x1',
    weight: 100,
    volWeight: 10,
    loadHelp: false,
    unloadHelp: false,
    payment: 'cash',
    loadFrom: new Date(),
    loadTo: new Date(Date.now() + 3600000),
    unloadFrom: new Date(Date.now() + 86400000),
    unloadTo: new Date(Date.now() + 90000000),
    insurance: false,
    systemPrice: 100,
    price: 100,
    photos: [],
  });

  console.log('Seeded');
  process.exit();
}

seed();
