const crypto = require('node:crypto');
const { Op, fn, col, where } = require('sequelize');
const db = require('../config/db');
const User = require('../models/user');
const Order = require('../models/order');
const DriverProfile = require('../models/driverProfile');
const Rating = require('../models/rating');
const Favorite = require('../models/favorite');
const SavedSearch = require('../models/savedSearch');
const Notification = require('../models/notification');
const SupportQuestion = require('../models/supportQuestion');
const OrderResponse = require('../models/orderResponse');
const OrderRouteSearchEvent = require('../models/orderRouteSearchEvent');
const PortalAdmin = require('../models/portalAdmin');
const AccountDeletionJob = require('../models/accountDeletionJob');
const UserUpload = require('../models/userUpload');
const uploads = require('../utils/uploadFiles');
const authCodes = require('./authCodes');
const { disconnectUser, broadcastOrder } = require('../ws');

const DELETED_ACCOUNT_NAME = 'Акаунт видалено';
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED'];

function collectFiles(value, files) {
  if (typeof value === 'string' && value.startsWith('/uploads/')) files.add(value);
  else if (Array.isArray(value)) value.forEach(item => collectFiles(item, files));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectFiles(item, files));
}
function parseHistory(value) {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
function accountError(code, message, status = 409, details = {}) {
  return Object.assign(new Error(message), { code, status, details });
}

async function anonymizeAccount(userId) {
  let phone;
  const changedOrders = [];
  await db.transaction(async transaction => {
    const [guards] = await db.query(`SELECT count(*)::int AS count FROM pg_trigger
      WHERE NOT tgisinternal AND tgenabled IN ('O', 'A') AND tgname IN ('guard_user_reference', 'guard_deleted_user', 'guard_deleted_history')
      AND tgrelid IN ('users'::regclass, 'orders'::regclass, '"DriverProfiles"'::regclass,
        'ratings'::regclass, 'transactions'::regclass, 'favorites'::regclass,
        '"savedSearches"'::regclass, 'notifications'::regclass, '"supportQuestions"'::regclass,
        '"orderResponses"'::regclass, '"orderRouteSearchEvents"'::regclass, '"userUploads"'::regclass)`, { transaction });
    if (guards[0].count !== 13) throw accountError('MIGRATION_REQUIRED', 'Account deletion migration required', 503);
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw accountError('ACCOUNT_NOT_FOUND', 'Акаунт не знайдено', 401);
    if (user.deletedAt) return;
    const activeOrders = await Order.findAll({
      where: {
        [Op.or]: [{ customerId: userId }, { driverId: userId }],
        status: { [Op.notIn]: TERMINAL_STATUSES },
      }, attributes: ['id', 'status'], transaction, lock: transaction.LOCK.UPDATE,
    });
    if (activeOrders.length) throw accountError('ACTIVE_ORDERS',
      'Завершіть або скасуйте активні замовлення перед видаленням акаунта.', 409,
      { orders: activeOrders.map(order => ({ id: order.id, status: order.status })) });

    // Triggers protect against stale authenticated writes and concurrent assignments.
    // Only this transaction may anonymize historical rows containing deleted parties.
    await db.query("SET LOCAL vango.account_deletion = 'on'", { transaction });
    const files = new Set();
    collectFiles(user.selfiePhoto, files);
    const ownedUploads = await UserUpload.findAll({where: {userId}, transaction});
    ownedUploads.forEach(upload => collectFiles(upload.url, files));
    const profile = await DriverProfile.findOne({ where: { userId }, transaction, lock: transaction.LOCK.UPDATE });
    if (profile) collectFiles(profile.toJSON(), files);
    const questions = await SupportQuestion.findAll({ where: { userId }, transaction, lock: transaction.LOCK.UPDATE });
    questions.forEach(question => collectFiles(question.photos, files));
    const orders = await Order.findAll({ where: {
      [Op.or]: [
        { customerId: userId }, { driverId: userId }, { reservedBy: userId }, { candidateDriverId: userId },
        // history is JSON (not JSONB) in the current schema.
        where(db.cast(col('history'), 'jsonb'), { [Op.contains]: db.cast(JSON.stringify([{ changedById: userId }]), 'jsonb') }),
        where(db.cast(col('history'), 'jsonb'), { [Op.contains]: db.cast(JSON.stringify([{ uploadedBy: userId }]), 'jsonb') }),
      ],
    }, transaction, lock: transaction.LOCK.UPDATE });
    for (const order of orders) {
      const participant = order.customerId === userId || order.driverId === userId;
      if (participant) {
        collectFiles(order.photos, files);
        // The schema cannot distinguish whose personal address/cargo text it contains.
        // Remove these snapshots, preserving dates, statuses and monetary amounts.
        for (const field of ['pickupLocation', 'dropoffLocation', 'pickupAddress', 'dropoffAddress',
          'pickupPostcode', 'dropoffPostcode', 'pickupCity', 'dropoffCity', 'pickupCountry', 'dropoffCountry', 'cargoType']) {
          order[field] = DELETED_ACCOUNT_NAME;
        }
        for (const field of ['pickupLat', 'pickupLon', 'dropoffLat', 'dropoffLon']) order[field] = null;
        order.photos = [];
      }
      order.history = parseHistory(order.history).map(entry => {
        if (!participant && Number(entry.changedById) !== userId && Number(entry.uploadedBy) !== userId) return entry;
        collectFiles(entry, files);
        // Whitelist structured historical facts; drop free text, photos and actor identifiers.
        const safe = {};
        for (const field of ['status', 'at', 'changedByRole', 'price', 'finalPrice', 'previousValue', 'newValue', 'fromPrice', 'toPrice', 'field']) {
          if (entry[field] != null && (field === 'status' || field === 'at' || field === 'changedByRole' || field === 'field' || typeof entry[field] === 'number')) safe[field] = entry[field];
        }
        safe.actorName = DELETED_ACCOUNT_NAME;
        return safe;
      });
      if (order.reservedBy === userId) { order.reservedBy = null; order.reservedUntil = null; }
      if (order.candidateDriverId === userId) {
        order.candidateDriverId = null; order.candidateUntil = null;
        if (order.status === 'PENDING' && !order.driverId) {
          order.status = 'CREATED';
          order.history = [...order.history, {status: 'CREATED', at: new Date().toISOString(), reason: 'ACCOUNT_DELETED'}];
        }
      }
      await order.save({ transaction });
      changedOrders.push(order.id);
    }
    await Rating.update({ comment: null }, { where: { [Op.or]: [{ fromUserId: userId }, { toUserId: userId }] }, transaction });
    // Notifications may include snapshots of a participant's name, phone or photo.
    const notificationConditions = [{ userId }];
    for (const id of changedOrders) {
      notificationConditions.push(where(db.cast(col('data'), 'jsonb'), { [Op.contains]: db.cast(JSON.stringify({ orderId: id }), 'jsonb') }));
      notificationConditions.push(where(db.cast(col('data'), 'jsonb'), { [Op.contains]: db.cast(JSON.stringify({ orderId: String(id) }), 'jsonb') }));
    }
    notificationConditions.push(where(db.cast(col('data'), 'jsonb'), { [Op.contains]: db.cast(JSON.stringify({ targetUserId: userId }), 'jsonb') }));
    await Notification.destroy({ where: { [Op.or]: notificationConditions }, transaction });
    for (const [model, condition] of [
      [DriverProfile, { userId }], [SupportQuestion, { userId }],
      [Favorite, { [Op.or]: [{ customerId: userId }, { driverId: userId }] }],
      [SavedSearch, { driverId: userId }], [OrderResponse, { driverId: userId }],
      [OrderRouteSearchEvent, { driverId: userId }],
    ]) await model.destroy({ where: condition, transaction });

    const adminConditions = [where(fn('lower', col('email')), String(user.email).toLowerCase())];
    if (user.phone) {
      const normalized = authCodes.normalizePhone(user.phone);
      const variants = [normalized, normalized.startsWith('38') ? normalized.slice(2) : normalized];
      adminConditions.push(where(fn('regexp_replace', col('phone'), '[^0-9]', '', 'g'), { [Op.in]: variants }));
    }
    await PortalAdmin.destroy({ where: { [Op.or]: adminConditions }, transaction });
    phone = user.phone;
    await AccountDeletionJob.create({ userId, pendingFiles: [...files] }, { transaction });
    // A pseudonymous, non-login historical party preserves monetary amounts/FKs.
    await user.update({
      name: DELETED_ACCOUNT_NAME, email: `deleted-${crypto.randomUUID()}@deleted.invalid`,
      password: crypto.randomBytes(48).toString('hex'), phone: null, city: null,
      firstName: null, lastName: null, patronymic: null, selfiePhoto: null,
      pushToken: null, pushConsent: false, blocked: true, isAdmin: false,
      isDispatcher: false, groupId: null, role: 'BOTH', rating: 0, deletedAt: new Date(),
      // Keep balance: deletion is not settlement or forgiveness of an external debt.
    }, { transaction });
  });
  if (phone) authCodes.clear(phone);
  disconnectUser(userId);
  // Read fresh snapshots after the commit. A broadcast failure must not undo deletion.
  for (const id of changedOrders) {
    try { const order = await Order.findByPk(id, { include: { model: User, as: 'customer' } }); if (order) broadcastOrder(order); }
    catch { /* clients refetch on reconnect */ }
  }
}

async function finishFileCleanup(userId) {
  return db.transaction(async transaction => {
    const job = await AccountDeletionJob.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!job) throw accountError('DELETION_JOB_MISSING', 'Не вдалося перевірити стан видалення.', 503);
    if (job.completedAt) return true;
    const failed = [];
    for (const url of job.pendingFiles) {
      try {
        const inFlight = await UserUpload.findOne({where: {userId, url, uploading: true}, transaction});
        if (inFlight?.writerLockKey) {
          // Session locks disappear on process/connection death. No age-based guess
          // can accidentally remove a slow but still active writer's file.
          const [rows] = await db.query('SELECT pg_try_advisory_xact_lock(CAST($key AS bigint)) AS acquired', {
            bind: {key: inFlight.writerLockKey}, transaction,
          });
          if (!rows[0].acquired) { failed.push(url); continue; }
        }
        await uploads.deleteUploadByUrl(url);
        await UserUpload.destroy({where: {userId, url}, transaction});
      }
      catch { failed.push(url); }
    }
    await job.update({ pendingFiles: failed, completedAt: failed.length ? null : new Date() }, { transaction });
    return failed.length === 0;
  });
}
async function deleteOwnAccount(userId) {
  await anonymizeAccount(userId);
  const completed = await finishFileCleanup(userId);
  return { status: completed ? 'deleted' : 'cleanup_pending',
    scope: 'application_data', externalCopies: 'operator_review_required' };
}
async function retryPendingDeletions() {
  const jobs = await AccountDeletionJob.findAll({ where: { completedAt: null }, attributes: ['userId'] });
  for (const job of jobs) {
    try { await finishFileCleanup(job.userId); } catch { /* durable job is retried next time */ }
  }
}
module.exports = { deleteOwnAccount, finishFileCleanup, retryPendingDeletions, DELETED_ACCOUNT_NAME };
