const assert = require('node:assert/strict');
const { test } = require('node:test');
const codes = require('../src/services/authCodes');
const fs = require('node:fs');
const vm = require('node:vm');

test('test account detection supports authentication phone formats without granting default privilege', () => {
  for (const phone of ['380000000001', '+380 (00) 000-00-01', '0000000001']) {
    assert.equal(codes.isTestAccountPhone(phone), true);
    assert.equal(codes.getTestAuthCode(phone), '111111');
  }
  for (const phone of [null, undefined, '', '380671234567']) assert.equal(codes.isTestAccountPhone(phone), false);
  const module = { exports: {} };
  const ensure = () => {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/services/defaultUserAccess'), 'utf8'), {
    module, require: () => ({ensureTestAccountAccess: ensure}),
  });
  assert.equal(module.exports.hasDefaultPrivilegedAccess('380000000001'), false);
  assert.equal(module.exports.ensureDefaultUserAccess, ensure);
});
