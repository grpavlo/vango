const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { UserRole } = require('../models/user');
const { JWT_SECRET } = require('../config');
const DriverProfile = require('../models/driverProfile');
const { sendSms } = require('../services/turbosms');
const { generateCode, set: setCode, verifyAndConsume, normalizePhone } = require('../services/authCodes');

function pathToUrl(p) {
  return p ? p.replace(/^.*[\\/]uploads[\\/]/, '/uploads/') : null;
}

async function sendPhoneCode(req, res) {
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return res.status(400).send('Вкажіть коректний номер телефону');
  }
  const code = generateCode();
  setCode(phone, code);
  const result = await sendSms(phone, `${code} - код для входу в VanGo. Дійсний 5 хв.`);
  if (!result.ok) {
    return res.status(500).send(result.error || 'Не вдалося відправити SMS');
  }
  res.json({ sent: true });
}

async function verifyPhoneCode(req, res) {
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return res.status(400).send('Вкажіть коректний номер телефону');
  }
  if (!code || code.length !== 6) {
    return res.status(400).send('Введіть 6-значний код');
  }
  if (!verifyAndConsume(phone, code)) {
    return res.status(400).send('Невірний або прострочений код');
  }
  const normalizedPhone = normalizePhone(phone);
  const phoneStr = normalizedPhone.startsWith('38') ? normalizedPhone : '38' + normalizedPhone;
  const { Op } = require('sequelize');
  let user = await User.findOne({
    where: {
      [Op.or]: [
        { phone: phoneStr },
        { phone: phoneStr.replace(/^38/, '0') },
        { phone: phoneStr.replace(/^38/, '') },
      ],
    },
  });
  if (!user) {
    const emailPlaceholder = `user_${phoneStr}@vango.phone`;
    const hashed = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), 10);
    user = await User.create({
      name: '',
      email: emailPlaceholder,
      password: hashed,
      phone: phoneStr,
      role: UserRole.BOTH,
    });
  }
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, role: user.role });
}

async function register(req, res) {
  const { name, email, password, city, phone } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, city, phone });
    res.json(user);
  } catch (err) {
    res.status(400).send('Помилка реєстрації');

  }
}

async function login(req, res) {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      res.status(400).send('Невірна електронна пошта або пароль');

      return;
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(400).send('Невірна електронна пошта або пароль');

      return;
    }
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, role: user.role });
  } catch (err) {
    res.status(400).send('Помилка входу');

  }
}

async function profile(req, res) {
  res.json(req.user);
}

async function updateProfile(req, res) {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  if (!name) {
    return res.status(400).send('Вкажіть ПІБ');
  }
  if (!phone) {
    return res.status(400).send('Вкажіть номер телефону');
  }

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return res.status(400).send('Некоректний номер телефону');
  }

  try {
    req.user.name = name;
    req.user.phone = phone;
    await req.user.save();
    res.json({
      id: req.user.id,
      name: req.user.name,
      phone: req.user.phone,
      email: req.user.email,
      role: req.user.role,
    });
  } catch (err) {
    res.status(400).send('Не вдалося оновити профіль');
  }
}

async function updateCustomerProfile(req, res) {
  const body = req.body || {};
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const patronymic = typeof body.patronymic === 'string' ? body.patronymic.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  const fullName = [lastName, firstName, patronymic].filter(Boolean).join(' ');
  if (!fullName && !req.user.name) {
    return res.status(400).send('Вкажіть ім\'я, прізвище або по-батькові');
  }
  if (!phone) {
    return res.status(400).send('Вкажіть номер телефону');
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return res.status(400).send('Некоректний номер телефону');
  }

  try {
    const user = req.user;
    if (fullName) {
      user.name = fullName;
      user.firstName = firstName || null;
      user.lastName = lastName || null;
      user.patronymic = patronymic || null;
    }
    user.phone = phone;
    if (req.file?.path) {
      user.selfiePhoto = pathToUrl(req.file.path);
    }
    await user.save();

    const driverProfile = await DriverProfile.findOne({ where: { userId: user.id } });
    if (driverProfile) {
      if (fullName) driverProfile.fullName = fullName;
      if (req.file?.path) driverProfile.selfiePhoto = pathToUrl(req.file.path);
      await driverProfile.save();
    }

    res.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      patronymic: user.patronymic,
      selfiePhoto: user.selfiePhoto,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    res.status(400).send('Не вдалося оновити профіль');
  }
}

async function updateRole(req, res) {
  const role = req.body && req.body.role;
  if (!role || ![UserRole.DRIVER, UserRole.CUSTOMER, UserRole.BOTH].includes(role)) {
    res.status(400).send('Invalid role');

    return;
  }
  req.user.role = role;
  await req.user.save();
  res.json({ role: req.user.role });
}

async function updatePushToken(req, res) {
  const token = req.body && req.body.token;
  if (!token) return res.status(400).send('Token required');
  req.user.pushToken = token;
  await req.user.save();
  res.sendStatus(204);
}

async function updatePushConsent(req, res) {
  const consent = !!(req.body && req.body.consent);
  req.user.pushConsent = consent;
  await req.user.save();
  res.json({ pushConsent: req.user.pushConsent });
}

module.exports = {
  register,
  login,
  sendPhoneCode,
  verifyPhoneCode,
  profile,
  updateProfile,
  updateCustomerProfile,
  updateRole,
  updatePushToken,
  updatePushConsent,
};
