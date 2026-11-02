const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const authCodes = require('../src/services/authCodes');

for (const scenario of ['new', 'existing', 'driver', 'ordinary']) {
  test(`phone login grants default access: ${scenario}`, async () => {
    const privileged = scenario !== 'ordinary';
    const phone = privileged ? '+380000000001' : '380671234567';
    let saved = false;
    let user = scenario === 'new' ? null : {
      id: 2, role: scenario === 'driver' ? 'DRIVER' : 'CUSTOMER',
      isAdmin: false, isDispatcher: false,
      async save() { saved = true; },
    };
    const User = {
      async findOne() { return user; },
      async create(values) { user = { id: 2, ...values }; return user; },
    };
    const roles = { BOTH: 'BOTH', ADMIN: 'ADMIN', DRIVER: 'DRIVER' };
    const service = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/services/defaultUserAccess'), 'utf8'), {
      module: service,
      require(name) {
        if (name === '../services/authCodes' || name === './authCodes') return authCodes;
        if (name === '../models/user') return User;
        if (name === 'sequelize') return require('sequelize');
        return {};
      },
    });
    const controller = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/controllers/authController'), 'utf8'), {
      module: controller, process, console,
      require(name) {
        if (name === '../models/user') return Object.assign(User, { UserRole: roles });
        if (name === '../services/authCodes') return authCodes;
        if (name === '../services/defaultUserAccess') return service.exports;
        if (name === 'sequelize') return require('sequelize');
        if (name === 'bcryptjs') return { async hash() { return 'hash'; } };
        if (name === 'crypto') return require('crypto');
        if (name === 'jsonwebtoken') return { sign() { return 'token'; } };
        return {};
      },
    });
    if (!privileged) authCodes.set(phone, '654321');
    const response = { json(body) { this.body = body; } };
    await controller.exports.verifyPhoneCode({ body: { phone, code: privileged ? '111111' : '654321' } }, response);
    assert.equal(user.isAdmin, privileged);
    assert.equal(user.isDispatcher, privileged);
    assert.equal(user.role, scenario === 'new' || scenario === 'driver' ? 'BOTH' : 'CUSTOMER');
    if (privileged && scenario !== 'new') assert.equal(saved, true);
    assert.equal(response.body.isAdmin, privileged);
    assert.equal(service.exports.hasDefaultPrivilegedAccess('0000000001'), true);
  });
}
