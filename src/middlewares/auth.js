const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const User = require('../models/user');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(payload.id);
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    if (user.blocked) return res.status(403).json({ message: 'User is blocked' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Unauthorized' });
  }
}

function authorize(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (roles.includes(req.user.role)) {
      return next();
    }
    if (
      req.user.role === 'BOTH' &&
      (roles.includes('DRIVER') || roles.includes('CUSTOMER'))
    ) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden' });
  };
}

module.exports = { authenticate, authorize };
