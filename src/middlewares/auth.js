const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const User = require('../models/user');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send('Токен відсутній');
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(payload.id);
    if (!user) return res.status(401).send('Недійсний токен');
    if (user.blocked) return res.status(403).send('Користувача заблоковано');
    req.user = user;
    next();
  } catch (err) {
    res.status(401).send('Невірний токен');
  }
}

function authorize(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).send('Доступ заборонено');

    }
    const allowedRoles = roles.map((role) => String(role || '').trim().toUpperCase());
    const userRole = String(req.user.role || '').trim().toUpperCase();
    if (allowedRoles.includes(userRole)) {
      return next();
    }
    if (allowedRoles.includes('ADMIN') && (req.user.isAdmin || userRole === 'ADMIN')) {
      return next();
    }
    if (
      userRole === 'BOTH' &&
      (allowedRoles.includes('DRIVER') || allowedRoles.includes('CUSTOMER'))
    ) {
      return next();
    }
    return res.status(403).send('Доступ заборонено');

  };
}

module.exports = { authenticate, authorize };
