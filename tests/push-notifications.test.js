const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function harness({failDelivery = false} = {}) {
  const rows = [], deliveries = [];
  class Expo {
    static isExpoPushToken(value) { return value.startsWith('ExponentPushToken['); }
    async sendPushNotificationsAsync(messages) { deliveries.push(...messages); if (failDelivery) throw Error('offline'); return []; }
  }
  const module = {exports: {}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/utils/push'), 'utf8'), {
    module, exports: module.exports, console: {log() {}, error() {}},
    require(id) {
      if (id === 'expo-server-sdk') return {Expo};
      if (id === '../models/user') return {findAll: async ({where}) => [{id: where.id, pushConsent: false}]};
      if (id === '../models/notification') return {bulkCreate: async entries => rows.push(...entries)};
      throw Error(id);
    },
  });
  return {...module.exports, rows, deliveries};
}
test('web user without token or push consent receives an inbox notification', async () => {
  const h = harness();
  await h.sendUserNotification({id: 7, pushConsent: false}, 'Пропозиція', 'Нова пропозиція', {orderId: 42});
  assert.equal(h.rows.length, 1);
  assert.equal(h.rows[0].userId, 7);
  assert.equal(h.rows[0].data.orderId, 42);
  assert.equal(h.deliveries.length, 0);
});
test('mobile consent is respected even with a valid token', async () => {
  const h = harness();
  await h.sendUserNotification({id: 7, pushConsent: false, pushToken: 'ExponentPushToken[test]'}, 'Title', 'Body');
  assert.equal(h.rows.length, 1);
  assert.equal(h.deliveries.length, 0);
});
test('push failure does not lose or duplicate inbox notification', async () => {
  const h = harness({failDelivery: true});
  await h.sendUserNotification({id: 7, pushConsent: true, pushToken: 'ExponentPushToken[test]'}, 'Title', 'Body', {recipientUserId: 9});
  assert.equal(h.rows.length, 1);
  assert.equal(h.rows[0].userId, 7);
  assert.equal(h.deliveries.length, 1);
});
test('invalid mobile token still allows web notification', async () => {
  const h = harness();
  await h.sendUserNotification({id: 7, pushConsent: true, pushToken: 'invalid'}, 'Title', 'Body');
  assert.equal(h.rows.length, 1);
  assert.equal(h.deliveries.length, 0);
});
