const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const User = require('../models/user');
const { isTestAccountPhone } = require('../services/authCodes');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send('Токен відсутній');
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(payload.id);
    if (!user || user.deletedAt) return res.status(401).send('Недійсний токен');
    if (user.blocked) return res.status(403).send('Користувача заблоковано');
    // Old sessions must not retain demo privileges in controllers that inspect flags directly.
    if (isTestAccountPhone(user.phone)) {
      user.isAdmin = false;
      user.isDispatcher = false;
      if (user.role === 'ADMIN') user.role = 'BOTH';
    }
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
    if (isTestAccountPhone(req.user.phone) && allowedRoles.includes('ADMIN') &&
        !allowedRoles.some(role => ['DRIVER', 'CUSTOMER', 'BOTH'].includes(role))) {
      return res.status(403).send('Доступ заборонено');
    }
    if (allowedRoles.includes(userRole) && !(userRole === 'ADMIN' && isTestAccountPhone(req.user.phone))) {
      return next();
    }
    if (!isTestAccountPhone(req.user.phone) && allowedRoles.includes('ADMIN') && (req.user.isAdmin || userRole === 'ADMIN')) {
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
