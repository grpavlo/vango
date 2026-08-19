const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const PortalAdmin = require('../models/portalAdmin');
const User = require('../models/user');
const { normalizePhone } = require('./authCodes');

async function ensurePortalAdminFromEnv() {
  const email = String(process.env.PORTAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.PORTAL_ADMIN_PASSWORD || '');
  const name = String(process.env.PORTAL_ADMIN_NAME || 'Portal Admin').trim();
  const phoneRaw = String(process.env.PORTAL_ADMIN_PHONE || '').trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;

  if (!email || !password) {
    return null;
  }

  const existing = await PortalAdmin.findOne({ where: { email } });
  if (existing) {
    if (phone && existing.phone !== phone) {
      existing.phone = phone;
      await existing.save();
    }
    return existing;
  }

  const hashed = await bcrypt.hash(password, 10);
  return PortalAdmin.create({
    email,
    phone,
    password: hashed,
    name,
    active: true,
  });
}

async function syncPortalAdminsFromLegacyUsers() {
  const legacyAdmins = await User.findAll({
    where: {
      [Op.or]: [{ isAdmin: true }, { role: 'ADMIN' }],
    },
  });

  for (const user of legacyAdmins) {
    const email = String(user.email || '').trim().toLowerCase();
    if (!email || !user.password) continue;

    const phone = user.phone ? normalizePhone(user.phone) : null;
    const existing = await PortalAdmin.findOne({ where: { email } });
    if (existing) {
      let changed = false;
      if (phone && existing.phone !== phone) {
        existing.phone = phone;
        changed = true;
      }
      if (existing.active === user.blocked) {
        existing.active = !user.blocked;
        changed = true;
      }
      if (changed) await existing.save();
      continue;
    }

    await PortalAdmin.create({
      email,
      phone,
      password: user.password,
      name: user.name || email,
      active: !user.blocked,
    });
  }
}

module.exports = {
  ensurePortalAdminFromEnv,
  syncPortalAdminsFromLegacyUsers,
};
