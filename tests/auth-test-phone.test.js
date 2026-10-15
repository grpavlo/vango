const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const authCodes = require('../src/services/authCodes');

test('test phone works in production without SMS or shared process state', async (t) => {
  const env = {
    NODE_ENV: 'production',
    DISABLE_DEV_SMS_FALLBACK: 'true',
    DEV_SMS_BYPASS: '0',
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }

  let smsCalls = 0;
  const controller = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/controllers/authController'), 'utf8'), {
    module: controller,
    console,
    process,
    require(name) {
      if (name === '../services/authCodes') return authCodes;
      if (name === '../services/turbosms') return {
        async sendSms() {
          smsCalls += 1;
          return { ok: false, error: 'SMS service is not configured' };
        },
      };
      return {};
    },
  });
  function response() {
    return {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
      send(body) { this.body = body; return this; },
    };
  }

  for (const phone of ['380000000001', '+380000000001', '0000000001']) {
    const res = response();
    await controller.exports.sendPhoneCode({ body: { phone } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sent, true);
    assert.equal(res.body.smsSkipped, true);
    assert.equal(res.body.devCode, '111111');
    assert.equal(authCodes.get(phone), null);
    assert.equal(authCodes.verifyAndConsumeOrDev(phone, '111111'), true);
    assert.equal(authCodes.verifyAndConsumeOrDev(phone, '222222'), false);
  }
  assert.equal(smsCalls, 0);

  const realPhone = '380671234567';
  assert.equal(authCodes.getTestAuthCode(realPhone), null);
  assert.equal(authCodes.verifyAndConsumeOrDev(realPhone, '111111'), false);
  const res = response();
  await controller.exports.sendPhoneCode({ body: { phone: realPhone } }, res);
  assert.equal(smsCalls, 1);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.devCode, undefined);
  authCodes.set(realPhone, '654321');
  assert.equal(authCodes.verifyAndConsumeOrDev(realPhone, '654321'), true);
  assert.equal(authCodes.verifyAndConsumeOrDev(realPhone, '654321'), false);
});
