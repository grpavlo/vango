const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { initDb } = require('../config/db');

const router = express.Router();
let userModel;

initDb().then(pool => {
  userModel = new User(pool);
}).catch(err => {
  console.error('DB init error', err);
});

router.post('/login', async (req, res) => {
  if (!userModel) {
    return res.status(500).json({ message: 'Database not initialized' });
  }
  const { username, password } = req.body;
  const user = await userModel.findByUsername(username);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '1h' }
  );
  res.json({ token });
});

module.exports = router;

