const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { UserRole } = require('../models/user');
const { JWT_SECRET } = require('../config');

async function register(req, res) {
  const { name, email, password, city } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, city });
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
  const { role } = req.body;
  if (!role || ![UserRole.DRIVER, UserRole.CUSTOMER, UserRole.BOTH].includes(role)) {
    res.status(400).send('Invalid role');

    return;
  }
  req.user.role = role;
  await req.user.save();
  res.json({ role: req.user.role });
}

module.exports = { register, login, profile, updateRole };
