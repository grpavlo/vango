const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const User = require('../models/user');
const { deleteOwnAccount } = require('../services/accountDeletion');

// Deleted users can only retry this self-deletion operation; no general API access.
async function authenticateDeletion(req, res, next) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ code: 'UNAUTHORIZED' });
  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); }
  catch { return res.status(401).json({ code: 'UNAUTHORIZED' }); }
  if (!Number.isInteger(payload.id) || payload.type || payload.portalAdminId) {
    return res.status(401).json({ code: 'UNAUTHORIZED' });
  }
  try {
    const user = await User.findByPk(payload.id);
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED' });
    if (user.blocked && !user.deletedAt) return res.status(403).json({ code: 'ACCOUNT_BLOCKED' });
    req.deletionUserId = user.id;
    next();
  } catch { return res.status(503).json({ code: 'DELETION_UNAVAILABLE' }); }
}
async function deleteAccount(req, res) {
  if (req.body?.confirm !== true || Object.keys(req.body).some(key => key !== 'confirm') || Object.keys(req.query).length) {
    return res.status(400).json({ code: 'INVALID_CONFIRMATION', message: 'Підтвердьте видалення власного акаунта.' });
  }
  try {
    const result = await deleteOwnAccount(req.deletionUserId);
    return res.status(result.status === 'deleted' ? 200 : 202).json(result);
  } catch (error) {
    if (error.code === 'ACTIVE_ORDERS') return res.status(409).json({
      code: error.code, message: error.message, ...error.details,
    });
    // No stack traces, identifiers or file paths in responses/logs.
    return res.status(503).json({ code: 'DELETION_RETRY_REQUIRED',
      message: 'Не вдалося завершити видалення. Повторіть запит.' });
  }
}
module.exports = { authenticateDeletion, deleteAccount };
