const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { UserRole } = require('../models/user');
const { JWT_SECRET } = require('../config');


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
  profile,
  updateProfile,
  updateRole,
  updatePushToken,
  updatePushConsent,
};
