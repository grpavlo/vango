const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
// Tests never load .env and only connect to this disposable test database.
const databaseUrl = process.env.DISPATCHER_TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/vango_dispatcher_test') {
  throw new Error('Set DISPATCHER_TEST_DATABASE_URL to the isolated vango_dispatcher_test database');
}
require('dotenv').config = () => ({ parsed: {} });
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = 'dispatcher-integration-test-only';
const { Sequelize } = require('sequelize');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../src/config/db');
const User = require('../src/models/user');
const Group = require('../src/models/group');
const Order = require('../src/models/order');
const Rating = require('../src/models/rating');
const PortalAdmin = require('../src/models/portalAdmin');
const { parseDispatcherQuery } = require('../src/utils/dispatcherAccess');
const { buildOrderAnalyticsReport } = require('../src/services/orderAnalyticsReport');
const migration = require('../src/migrations/20261007000000-add-dispatcher-access');
const app = express();
app.use(express.json());
app.use('/api/auth', require('../src/routes/authRoutes'));
app.use('/api/orders', require('../src/routes/orderRoutes'));
app.use('/api/dispatcher', require('../src/routes/dispatcherRoutes'));
app.use('/api/admin', require('../src/routes/adminRoutes'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use((error, req, res, next) => { res.status(error.status || 500).send(error.message); });
let server, base, owner, second, customer, driver, both, admin, portalAdmin, ownOrders, foreignOrder, otherDriver;
const range = 'dateFrom=2026-10-01&dateTo=2026-10-07';
const token = (user) => jwt.sign({ id: user.id }, process.env.JWT_SECRET);
async function request(url, user, options = {}) {
  const headers = { ...options.headers };
  if (user) headers.Authorization = `Bearer ${token(user)}`;
  if (options.body) headers['Content-Type'] = 'application/json';
  const result = await fetch(base + url, { ...options, headers, body: options.body ? JSON.stringify(options.body) : undefined });
  const text = await result.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: result.status, body };
}
async function user(name, role, extra = {}) {
  return User.create({ name, email: `${name}@test.invalid`, password: 'private-password', pushToken: 'private-token', role, ...extra });
}
async function order(customerId, extra = {}) {
  return Order.create({ customerId, pickupLocation: 'A', dropoffLocation: 'B', cargoType: 'test', price: 100, loadFrom: new Date(), loadTo: new Date(), unloadFrom: new Date(), unloadTo: new Date(), createdAt: new Date('2026-10-05T12:00:00Z'), updatedAt: new Date('2026-10-05T16:00:00Z'), ...extra });
}
before(async () => {
  await db.sync({ force: true });
  const group = await Group.create({ name: 'same-team' });
  owner = await user('owner', 'CUSTOMER', { isDispatcher: true, groupId: group.id });
  second = await user('second', 'CUSTOMER', { isDispatcher: true, groupId: group.id });
  customer = await user('customer', 'CUSTOMER');
  driver = await user('driver', 'DRIVER', { groupId: group.id });
  both = await user('both', 'BOTH');
  admin = await user('admin', 'BOTH', { isAdmin: true });
  otherDriver = await user('outside-driver', 'DRIVER');
  portalAdmin = await PortalAdmin.create({ name: 'portal-admin', email: 'portal@test.invalid', phone: '380999999999', password: 'test', active: true });
  ownOrders = [
    await order(owner.id, { driverId: driver.id, finalPrice: null, distance: 10, status: 'COMPLETED', photos: ['/uploads/own-test.jpg'], history: [{ status: 'ACCEPTED', at: '2026-10-05T12:10:00Z' }, { status: 'IN_PROGRESS', at: '2026-10-05T12:30:00Z' }, { status: 'DELIVERED', at: '2026-10-05T13:30:00Z' }, { status: 'COMPLETED', at: '2026-10-05T14:00:00Z' }] }),
    await order(owner.id, { candidateDriverId: driver.id, finalPrice: 0, status: 'CREATED', distance: null }),
  ];
  foreignOrder = await order(second.id, { driverId: otherDriver.id, price: 9999, photos: ['/uploads/foreign.jpg'] });
  await Rating.create({ orderId: ownOrders[0].id, fromUserId: owner.id, toUserId: driver.id, rating: 4, comment: 'own review' });
  await Rating.create({ orderId: foreignOrder.id, fromUserId: second.id, toUserId: otherDriver.id, rating: 1, comment: 'foreign review' });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.close();
});

test('personal report scopes rows, drivers, ratings and totals before SQL pagination', async () => {
  const result = await request(`/api/dispatcher/analytics/order-report?${range}&pageSize=1`, owner);
  assert.equal(result.status, 200);
  assert.equal(result.body.orderRows.length, 1);
  assert.equal(result.body.pagination.total, 2);
  assert.equal(result.body.totals.totalRevenue, 100);
  assert.equal(result.body.totals.averageDurationMinutes, 120);
  assert.equal(result.body.totals.completedRevenue, 100);
  assert.deepEqual(result.body.dailyRows, [{ key: "2026-10-05", count: 1, revenue: 100 }]);
  assert.equal(result.body.driverRows[0].customerRatingAverage, 4);
  assert.equal(result.body.totals.totalDistanceKm, 10);
  assert.deepEqual(result.body.drivers.map((d) => d.id), [driver.id]);
  assert.equal(result.body.customerRatings.count, 1);
  assert.equal(result.body.customerRatings.average, 4);
  assert.ok(!JSON.stringify(result.body).includes('foreign'));
  assert.ok(!JSON.stringify(result.body).includes('private-password'));
  const page2 = await request(`/api/dispatcher/analytics/order-report?${range}&pageSize=1&page=2`, owner);
  assert.equal(page2.body.orderRows[0].id, ownOrders[0].id);
  assert.equal(page2.body.orderRows[0].totalDurationMinutes, 120);
  assert.equal(page2.body.orderRows[0].cargoDurationMinutes, 60);
  assert.equal(page2.body.orderRows[0].revenue, 100);
  assert.equal(result.body.orderRows[0].revenue, 0);
  assert.equal(result.body.orderRows[0].driverAssignment, 'candidate');
  assert.equal(result.body.orderRows[0].roadDistanceKm, null);
  assert.deepEqual(page2.body.totals, result.body.totals);
});
test('foreign driver filter returns no rows or totals and no foreign driver metadata', async () => {
  const result = await request(`/api/dispatcher/analytics/order-report?${range}&driverId=${otherDriver.id}`, owner);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.orderRows, []);
  assert.deepEqual(result.body.driverRows, []);
  assert.equal(result.body.totals.orderCount, 0);
  assert.ok(!result.body.drivers.some((d) => d.id === otherDriver.id));
});
test('scoped list/details do not expose team orders or private user fields', async () => {
  const list = await request('/api/dispatcher/orders', owner);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((o) => o.id), [ownOrders[1].id, ownOrders[0].id]);
  const own = await request(`/api/dispatcher/orders/${ownOrders[0].id}`, owner);
  assert.equal(own.status, 200);
  assert.ok(!JSON.stringify(own.body).includes('private-'));
  assert.equal((await request(`/api/dispatcher/orders/${foreignOrder.id}`, owner)).status, 404);
  assert.equal((await request(`/api/dispatcher/orders/${ownOrders[0].id}`, second)).status, 404);
  assert.equal((await request('/api/dispatcher/orders?customerId=2', owner)).status, 400);
});
test('invalid query, role and ID fail closed', async () => {
  for (const query of ['role=ADMIN', 'customerId=2', 'groupId=1', 'scope=all', 'page=0', 'page=1x', 'pageSize=101', 'driverId=-1', 'driverId[x]=1', 'dateFrom=2026-02-30', 'dateFrom=2026-10-08&dateTo=2026-10-07']) {
    assert.equal((await request(`/api/dispatcher/analytics/order-report?${query}`, owner)).status, 400, query);
  }
  assert.equal((await request('/api/dispatcher/orders/abc', owner)).status, 400);
  assert.equal((await request('/api/orders/my?role=not-a-role', owner)).status, 400);
  assert.equal((await request('/api/orders/my?role=ADMIN', owner)).status, 403);
  assert.equal((await request('/api/orders/my?role=DRIVER', customer)).status, 403);
});
test('dispatcher has no global admin rights; ordinary roles have no dispatcher access', async () => {
  assert.equal((await request(`/api/dispatcher/analytics/order-report?${range}`)).status, 401);
  for (const who of [customer, driver, both, admin]) assert.equal((await request('/api/dispatcher/orders', who)).status, 403);
  for (const url of ['/api/admin/users', '/api/admin/orders', `/api/admin/analytics/order-report?${range}`]) assert.equal((await request(url, owner)).status, 403);
  assert.equal((await request(`/api/admin/users/${customer.id}/dispatcher-access`, owner, { method: 'PATCH', body: { enabled: true } })).status, 403);
});
test('admin grant/revoke works immediately with existing JWT; self role update cannot grant access', async () => {
  assert.equal((await request(`/api/admin/users/${customer.id}/dispatcher-access`, admin, { method: 'PATCH', body: { enabled: 'true' } })).status, 400);
  assert.equal((await request(`/api/admin/users/${driver.id}/dispatcher-access`, admin, { method: 'PATCH', body: { enabled: true } })).status, 400);
  const result = await request(`/api/admin/users/${customer.id}/dispatcher-access`, admin, { method: 'PATCH', body: { enabled: true } });
  assert.equal(result.status, 200);
  assert.equal((await request('/api/dispatcher/orders', customer)).status, 200);
  assert.equal((await request('/api/auth/me', customer)).body.isDispatcher, true);
  assert.equal((await request('/api/auth/role', customer, { method: 'PUT', body: { role: 'DRIVER', isDispatcher: false } })).status, 200);
  assert.equal((await User.findByPk(customer.id)).isDispatcher, true);
  assert.equal((await request('/api/dispatcher/orders', customer)).status, 200);
  await request('/api/auth/role', customer, { method: 'PUT', body: { role: 'CUSTOMER' } });
  const portalToken = jwt.sign({ type: 'portal-admin', portalAdminId: portalAdmin.id }, process.env.JWT_SECRET);
  const revoke = await request(`/api/admin/users/${customer.id}/dispatcher-access`, null, { headers: { Authorization: `Bearer ${portalToken}` }, method: 'PATCH', body: { enabled: false } });
  assert.equal(revoke.status, 200);
  assert.equal((await request('/api/dispatcher/orders', customer)).status, 403);
  assert.equal((await request('/api/orders/my?role=CUSTOMER&scope=own', customer)).status, 200);
  await request('/api/auth/role', customer, { method: 'PUT', body: { role: 'CUSTOMER', isDispatcher: true } });
  assert.equal((await User.findByPk(customer.id)).isDispatcher, false);
});
test('blocked user/invalid JWT are denied and profile/register cannot grant dispatcher access', async () => {
  await User.update({ blocked: true }, { where: { id: second.id } });
  assert.equal((await request('/api/dispatcher/orders', second)).status, 403);
  await User.update({ blocked: false }, { where: { id: second.id } });
  assert.equal((await request('/api/dispatcher/orders', null, { headers: { Authorization: 'Bearer invalid' } })).status, 401);
  assert.equal((await request('/api/auth/profile', customer, { method: 'PUT', body: { name: 'Customer', phone: '+380991234567', isDispatcher: true } })).status, 200);
  assert.equal((await User.findByPk(customer.id)).isDispatcher, false);
  const registered = await request('/api/auth/register', null, { method: 'POST', body: { name: 'registered', email: 'registered@test.invalid', password: 'test-password', isDispatcher: true } });
  assert.equal(registered.status, 200);
  assert.equal((await User.findByPk(registered.body.id)).isDispatcher, false);
});
test('existing admin report contract and valid customer/driver/BOTH lists remain available', async () => {
  const report = await request(`/api/admin/analytics/order-report?${range}`, admin);
  assert.equal(report.status, 200);
  assert.ok(report.body.orderRows.some((o) => o.id === foreignOrder.id));
  assert.equal(report.body.pagination, undefined);
  for (const [who, role] of [[owner, 'CUSTOMER'], [driver, 'DRIVER'], [both, 'BOTH'], [both, 'CUSTOMER'], [both, 'DRIVER']]) {
    assert.equal((await request(`/api/orders/my?role=${role}`, who)).status, 200);
  }
});
test('dispatcher creates as customer; foreign mutations fail; assigned driver and owner follow lifecycle', async () => {
  const created = await request('/api/orders', owner, { method: 'POST', body: { pickupLocation: 'A', dropoffLocation: 'B', pickupCity: 'A', dropoffCity: 'B', cargoType: 'boxes', price: 150, distance: 3, loadFrom: '2026-10-07T12:00:00Z', loadTo: '2026-10-07T13:00:00Z', unloadFrom: '2026-10-07T14:00:00Z', unloadTo: '2026-10-07T15:00:00Z', customerId: second.id } });
  assert.equal(created.status, 200);
  assert.equal(created.body.customerId, owner.id);
  assert.equal((await request(`/api/orders/${foreignOrder.id}`, owner, { method: 'PATCH', body: { cargoType: 'attack' } })).status, 400);
  assert.equal((await request(`/api/orders/${foreignOrder.id}`, owner, { method: 'DELETE' })).status, 400);
  assert.equal((await request(`/api/orders/${created.body.id}/status`, owner, { method: 'PATCH', body: { status: 'IN_PROGRESS' } })).status, 403);
  const response = await request(`/api/orders/${created.body.id}/respond`, driver, { method: 'POST', body: { finalPrice: 150, immediateConfirm: true } });
  assert.equal(response.status, 200);
  const confirmed = await request(`/api/orders/${created.body.id}/respond/${response.body.id}/confirm`, owner, { method: 'POST' });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.driverId, driver.id);
  for (const status of ['IN_PROGRESS', 'DELIVERED']) {
    assert.equal((await request(`/api/orders/${created.body.id}/status`, driver, { method: 'PATCH', body: { status } })).status, 200);
    assert.equal((await request(`/api/dispatcher/orders/${created.body.id}`, owner)).body.status, status);
  }
  assert.equal((await request(`/api/orders/${created.body.id}/status`, owner, { method: 'PATCH', body: { status: 'COMPLETED' } })).status, 200);
});
test('migration is reversible/idempotent and preserves existing rows', async () => {
  const count = await User.count();
  const qi = db.getQueryInterface();
  await migration.down(qi);
  await migration.down(qi);
  await migration.up(qi, Sequelize);
  await migration.up(qi, Sequelize);
  assert.equal(await User.count(), count);
  assert.equal((await User.findByPk(owner.id)).isDispatcher, false);
});
test('query dates use UTC and report requires explicit scope', async () => {
  const parsed = parseDispatcherQuery({ days: '7' }, new Date('2026-10-07T12:00:00Z'));
  assert.equal(parsed.range.start.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(parsed.range.end.toISOString(), '2026-10-07T23:59:59.999Z');
  await assert.rejects(() => buildOrderAnalyticsReport({ query: {} }), /scope/);
});
