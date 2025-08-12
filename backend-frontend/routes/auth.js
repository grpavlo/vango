const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { initDb } = require('../config/db');

const router = express.Router();
const db = initDb();
const userModel = new User(db);

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await userModel.findByUsername(username);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
  res.json({ token });
});

module.exports = router;
