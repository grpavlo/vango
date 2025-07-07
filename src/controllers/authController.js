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

async function testPush(req, res) {
  if (!req.user.pushToken) {
    console.log('Push test requested but no token for user', req.user.id);
    return res.status(400).send('No push token');
  }
  if (!req.user.pushConsent) {
    return res.status(400).send('Push not allowed');
  }
  const { sendPush } = require('../utils/push');
  console.log('Test push requested by', req.user.id);
  await sendPush(
    req.user.pushToken,
    'Test Notification',
    'This is a test notification',
    { test: true }
  );
  res.sendStatus(204);
}

module.exports = {
  register,
  login,
  profile,
  updateRole,
  updatePushToken,
  updatePushConsent,
  testPush,
};
