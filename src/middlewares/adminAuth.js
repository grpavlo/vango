const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const PortalAdmin = require('../models/portalAdmin');
const User = require('../models/user');

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return '';
  return token;
}

async function authenticateAdminAccess(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).send('Токен відсутній');

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (payload?.type === 'portal-admin' || payload?.portalAdminId) {
      const admin = await PortalAdmin.findByPk(payload.portalAdminId);
      if (!admin || !admin.active) {
        return res.status(401).send('Недійсний токен адміністратора');
      }
      req.portalAdmin = admin;
      req.adminActor = { type: 'portal-admin', id: admin.id };
      return next();
    }

    if (payload?.id) {
      const user = await User.findByPk(payload.id);
      if (!user) return res.status(401).send('Недійсний токен');
      if (user.blocked) return res.status(403).send('Користувача заблоковано');
      if (user.isAdmin || user.role === 'ADMIN') {
        req.user = user;
        req.adminActor = { type: 'user', id: user.id };
        return next();
      }
    }

    return res.status(403).send('Доступ заборонено');
  } catch {
    return res.status(401).send('Невірний токен');
  }
}

async function authenticatePortalAdmin(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).send('Токен відсутній');

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const admin = await PortalAdmin.findByPk(payload.portalAdminId);
    if (!admin || !admin.active || payload.type !== 'portal-admin') {
      return res.status(401).send('Недійсний токен адміністратора');
    }
    req.portalAdmin = admin;
    return next();
  } catch {
    return res.status(401).send('Невірний токен');
  }
}

module.exports = {
  authenticateAdminAccess,
  authenticatePortalAdmin,
};
