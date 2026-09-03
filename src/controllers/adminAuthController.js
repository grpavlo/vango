const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op, fn, col, where } = require('sequelize');
const PortalAdmin = require('../models/portalAdmin');
const User = require('../models/user');
const { JWT_SECRET } = require('../config');
const { sendSms } = require('../services/turbosms');
const {
  generateCode,
  set: setCode,
  verifyAndConsumeOrDev,
  normalizePhone,
  getDevAuthCode,
} = require('../services/authCodes');

const ADMIN_TOKEN_EXPIRES_IN = '90d';
const USER_TOKEN_EXPIRES_IN = '90d';

function buildPhoneLookupVariants(phone) {
  const normalizedPhone = normalizePhone(phone);
  const variants = new Set([normalizedPhone]);

  if (normalizedPhone.startsWith('380') && normalizedPhone.length === 12) {
    variants.add(`0${normalizedPhone.slice(3)}`);
  }

  return [...variants];
}

function phoneWhere(phone) {
  return {
    [Op.or]: buildPhoneLookupVariants(phone).map((phoneVariant) =>
      where(fn('regexp_replace', col('phone'), '[^0-9]', '', 'g'), phoneVariant)
    ),
  };
}

async function findLinkedUser(admin) {
  const conditions = [];
  const email = String(admin.email || '').trim().toLowerCase();

  if (email) {
    conditions.push({ email });
  }
  if (admin.phone) {
    conditions.push(phoneWhere(admin.phone));
  }
  if (!conditions.length) return null;

  return User.findOne({
    where: { [Op.or]: conditions },
    order: [['id', 'DESC']],
  });
}

function isTechnicalDisplayName(value) {
  return /^(user|portal)_\d+@vango\.(phone|admin)$/i.test(String(value || '').trim());
}

function linkedUserDisplayName(user) {
  if (!user) return '';
  const profileName = [user.lastName, user.firstName, user.patronymic].filter(Boolean).join(' ').trim();
  const name = String(user.name || '').trim();
  if (name && !isTechnicalDisplayName(name)) return name;
  return profileName || user.phone || user.email || '';
}

function adminDisplayName(admin, linkedUser = null) {
  const linkedName = linkedUserDisplayName(linkedUser);
  const adminName = String(admin.name || '').trim();
  if (linkedName) return linkedName;
  if (adminName && !isTechnicalDisplayName(adminName)) return adminName;
  return admin.phone || admin.email || '';
}

function serializeAdmin(admin, linkedUser = null) {
  return {
    id: admin.id,
    name: adminDisplayName(admin, linkedUser),
    email: admin.email,
    phone: admin.phone,
    selfiePhoto: linkedUser?.selfiePhoto || null,
    linkedUser: linkedUser
      ? {
          id: linkedUser.id,
          name: linkedUserDisplayName(linkedUser),
          email: linkedUser.email,
          phone: linkedUser.phone,
          firstName: linkedUser.firstName,
          lastName: linkedUser.lastName,
          patronymic: linkedUser.patronymic,
          selfiePhoto: linkedUser.selfiePhoto,
          role: linkedUser.role,
          isAdmin: linkedUser.isAdmin,
          blocked: linkedUser.blocked,
        }
      : null,
    isPortalAdmin: true,
  };
}

function buildAdminLoginCodeSms(code) {
  return `${code} - код для входу в портал VanGo. Дійсний 5 хв.`;
}

function shouldSkipSmsInDev() {
  return process.env.DEV_SMS_BYPASS === '1' && Boolean(getDevAuthCode());
}

function signAdminToken(admin) {
  return jwt.sign(
    { portalAdminId: admin.id, type: 'portal-admin' },
    JWT_SECRET,
    { expiresIn: ADMIN_TOKEN_EXPIRES_IN }
  );
}

function signUserToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: USER_TOKEN_EXPIRES_IN });
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
  const linkedUser = await findLinkedUser(admin);

  res.json({ token, admin: serializeAdmin(admin, linkedUser), isPortalAdmin: true });
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

  const devCode = getDevAuthCode();
  const skipSms = shouldSkipSmsInDev();
  const code = skipSms && devCode ? devCode : generateCode();
  setCode(normalizedPhone, code);
  if (skipSms) {
    return res.json({
      sent: true,
      smsSkipped: true,
      devCode: code,
    });
  }
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
  if (!verifyAndConsumeOrDev(normalizedPhone, code)) {
    return res.status(400).send('Невірний або прострочений код');
  }

  const admin = await PortalAdmin.findOne({ where: { phone: normalizedPhone } });
  if (!admin || !admin.active) {
    return res.status(400).send('Адміністратора з таким номером не знайдено');
  }

  const token = signAdminToken(admin);
  const linkedUser = await findLinkedUser(admin);
  return res.json({ token, admin: serializeAdmin(admin, linkedUser), isPortalAdmin: true });
}

async function portalAdminProfile(req, res) {
  const linkedUser = await findLinkedUser(req.portalAdmin);
  res.json(serializeAdmin(req.portalAdmin, linkedUser));
}

async function switchPortalAdminToUser(req, res) {
  const linkedUser = await findLinkedUser(req.portalAdmin);
  if (!linkedUser || linkedUser.blocked) {
    return res.status(404).send('Пов’язаний користувач не знайдений або заблокований');
  }

  const token = signUserToken(linkedUser);
  res.json({
    token,
    user: {
      id: linkedUser.id,
      name: linkedUser.name,
      email: linkedUser.email,
      phone: linkedUser.phone,
      role: linkedUser.role,
      isAdmin: linkedUser.isAdmin,
      groupId: linkedUser.groupId,
      firstName: linkedUser.firstName,
      lastName: linkedUser.lastName,
      patronymic: linkedUser.patronymic,
      selfiePhoto: linkedUser.selfiePhoto,
      city: linkedUser.city,
      rating: linkedUser.rating,
      blocked: linkedUser.blocked,
      pushConsent: linkedUser.pushConsent,
    },
  });
}

module.exports = {
  loginPortalAdmin,
  sendPortalAdminCode,
  verifyPortalAdminCode,
  portalAdminProfile,
  switchPortalAdminToUser,
};
