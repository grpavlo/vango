const { Op, fn, col, where } = require('sequelize');
const User = require('../models/user');
const { normalizePhone } = require('./authCodes');

const DEFAULT_PRIVILEGED_PHONE = '380000000001';

function hasDefaultPrivilegedAccess(phone) {
  return normalizePhone(phone) === DEFAULT_PRIVILEGED_PHONE;
}

async function ensureDefaultUserAccess() {
  // Match the same international/local phone forms as phone authentication.
  const phoneCondition = {
    [Op.or]: [DEFAULT_PRIVILEGED_PHONE, '0000000001'].map((phone) =>
      where(fn('regexp_replace', col('phone'), '[^0-9]', '', 'g'), phone)
    ),
  };
  await User.sequelize.transaction(async (transaction) => {
    await User.update(
      { isAdmin: true, isDispatcher: true },
      { where: phoneCondition, transaction }
    );
    await User.update(
      { role: User.UserRole.BOTH },
      { where: { ...phoneCondition, role: { [Op.in]: ['ADMIN', 'DRIVER'] } }, transaction }
    );
  });
}

module.exports = { hasDefaultPrivilegedAccess, ensureDefaultUserAccess };
