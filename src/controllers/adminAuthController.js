const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PortalAdmin = require('../models/portalAdmin');
const { JWT_SECRET } = require('../config');
const { sendSms } = require('../services/turbosms');
const {
  generateCode,
  set: setCode,
  verifyAndConsume,
  normalizePhone,
} = require('../services/authCodes');

const ADMIN_TOKEN_EXPIRES_IN = '90d';

function serializeAdmin(admin) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    phone: admin.phone,
    isPortalAdmin: true,
  };
}

function buildAdminLoginCodeSms(code) {
  return `${code} - код для входу в портал VanGo. Дійсний 5 хв.`;
}

function signAdminToken(admin) {
  return jwt.sign(
    { portalAdminId: admin.id, type: 'portal-admin' },
    JWT_SECRET,
    { expiresIn: ADMIN_TOKEN_EXPIRES_IN }
  );
}

async function loginPortalAdmin(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).send('Вкажіть email і пароль');
  }

  const admin = await PortalAdmin.findOne({ where: { email } });
  if (!admin || !admin.active) {
    return res.status(400).send('Невірна електронна пошта або пароль');
  }

  const match = await bcrypt.compare(password, admin.password);
  if (!match) {
    return res.status(400).send('Невірна електронна пошта або пароль');
  }

  const token = signAdminToken(admin);

  res.json({ token, admin: serializeAdmin(admin), isPortalAdmin: true });
}

async function sendPortalAdminCode(req, res) {
  const phone = String(req.body?.phone || '').trim();
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return res.status(400).send('Вкажіть коректний номер телефону');
  }

  const normalizedPhone = normalizePhone(phone);
  const admin = await PortalAdmin.findOne({ where: { phone: normalizedPhone } });
  if (!admin || !admin.active) {
    return res.status(400).send('Адміністратора з таким номером не знайдено');
  }

  const code = generateCode();
  setCode(normalizedPhone, code);
  const result = await sendSms(normalizedPhone, buildAdminLoginCodeSms(code));
  if (!result.ok) {
    return res.status(503).send('Не вдалося надіслати SMS. Спробуйте пізніше.');
  }

  return res.json({ sent: true });
}

async function verifyPortalAdminCode(req, res) {
  const phone = String(req.body?.phone || '').trim();
  const code = String(req.body?.code || '').trim();
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return res.status(400).send('Вкажіть коректний номер телефону');
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).send('Введіть 6-значний SMS-код');
  }

  const normalizedPhone = normalizePhone(phone);
  if (!verifyAndConsume(normalizedPhone, code)) {
    return res.status(400).send('Невірний або прострочений код');
  }

  const admin = await PortalAdmin.findOne({ where: { phone: normalizedPhone } });
  if (!admin || !admin.active) {
    return res.status(400).send('Адміністратора з таким номером не знайдено');
  }

  const token = signAdminToken(admin);
  return res.json({ token, admin: serializeAdmin(admin), isPortalAdmin: true });
}

async function portalAdminProfile(req, res) {
  res.json(serializeAdmin(req.portalAdmin));
}

module.exports = {
  loginPortalAdmin,
  sendPortalAdminCode,
  verifyPortalAdminCode,
  portalAdminProfile,
};
