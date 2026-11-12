const { Op, fn, col, where } = require('sequelize');
const User = require('../models/user');
const DriverProfile = require('../models/driverProfile');
const PortalAdmin = require('../models/portalAdmin');
const { isTestAccountPhone } = require('./authCodes');

const phoneCondition = () => ({
  [Op.or]: ['380000000001', '0000000001'].map(phone =>
    where(fn('regexp_replace', col('phone'), '[^0-9]', '', 'g'), phone)),
});
const demoProfile = {
  fullName: 'Демо Водій VanGo', noInn: false, inn: 'DEMO-INN',
  passportNumber: 'DEMO-PASSPORT', driverLicenseNumber: 'DEMO-LICENSE',
  vehicleTechNumber: 'DEMO-VEHICLE', carMake: 'Demo', carModel: 'Van',
  carYear: 2024, carPlate: 'DEMO-001', carLengthMm: 4200, carWidthMm: 2000, carHeightMm: 2200,
  innDocPhoto: '/demo-assets/document.png', passportPhotoMain: '/demo-assets/document.png',
  passportPhotoRegistration: '/demo-assets/document.png', driverLicensePhoto: '/demo-assets/document.png',
  vehicleTechPhoto: '/demo-assets/document.png', carPhotoFrontRight: '/demo-assets/vehicle.png',
  carPhotoRearLeft: '/demo-assets/vehicle.png', carPhotoInterior: '/demo-assets/vehicle.png',
  selfiePhoto: '/demo-assets/avatar.png',
};

async function isTestPortalAdmin(admin, options = {}) {
  if (isTestAccountPhone(admin?.phone)) return true;
  const email = String(admin?.email || '').trim().toLowerCase();
  if (!email) return false;
  return Boolean(await User.findOne({ ...options, where: {
    [Op.and]: [phoneCondition(), where(fn('lower', col('email')), email)],
  } }));
}

async function disableTestPortalAdmins(user, transaction) {
  const conditions = [phoneCondition()];
  if (user?.email) conditions.push(where(fn('lower', col('email')), user.email.toLowerCase()));
  await PortalAdmin.update({ active: false }, { where: { [Op.or]: conditions }, transaction });
}

async function prepareTestAccount(user) {
  if (!isTestAccountPhone(user?.phone) || user.deletedAt || user.blocked) return false;
  const prepared = await User.sequelize.transaction(async transaction => {
    const current = await User.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!current || current.deletedAt || current.blocked || !isTestAccountPhone(current.phone)) return null;
    current.isAdmin = false;
    current.isDispatcher = false;
    if (current.role === 'ADMIN') current.role = 'BOTH';
    const defaults = { name: 'Демо Водій VanGo', firstName: 'Водій', lastName: 'Демо',
      city: 'Київ', selfiePhoto: '/demo-assets/avatar.png' };
    for (const [key, value] of Object.entries(defaults)) if (!current[key]) current[key] = value;
    await current.save({ transaction });
    let profile = await DriverProfile.findOne({ where: { userId: current.id }, transaction });
    if (!profile) profile = DriverProfile.build({ userId: current.id, status: 'DRAFT' });
    for (const [key, value] of Object.entries(demoProfile)) {
      if (profile[key] == null || profile[key] === '') profile[key] = value;
    }
    await profile.save({ transaction });
    await disableTestPortalAdmins(current, transaction);
    return current;
  });
  if (!prepared) return false;
  user.set(prepared.get());
  return true;
}

async function ensureTestAccountAccess() {
  const users = await User.findAll({ where: phoneCondition() });
  for (const user of users) await prepareTestAccount(user);
  // Also revoke standalone legacy portal identities without a linked mobile row.
  await disableTestPortalAdmins(null);
}

function testAccountMetadata(user, ready = false) {
  const isTestAccount = isTestAccountPhone(user?.phone) && !user.deletedAt;
  return { isTestAccount, demoDriverProfileReady: isTestAccount && ready };
}

function identityChangeError(user, phone, email) {
  const currentTest = isTestAccountPhone(user.phone);
  if (currentTest !== isTestAccountPhone(phone)) return 'Номер тестового акаунта не можна змінити або привласнити';
  if (currentTest && email && email.toLowerCase() !== String(user.email).toLowerCase()) {
    return 'Електронну адресу тестового акаунта не можна змінити';
  }
  return null;
}

module.exports = { prepareTestAccount, ensureTestAccountAccess, isTestPortalAdmin,
  testAccountMetadata, identityChangeError };
