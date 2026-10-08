function badQuery(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}
function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) badQuery('Некоректний числовий параметр');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > maximum) badQuery('Параметр поза допустимими межами');
  return number;
}
function calendarDate(value) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) badQuery('Некоректна дата');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) badQuery('Некоректна дата');
  return date;
}
function parseDispatcherQuery(query = {}, now = new Date()) {
  const allowed = new Set(['days', 'dateFrom', 'dateTo', 'driverId', 'page', 'pageSize']);
  if (Object.keys(query).some((key) => !allowed.has(key))) badQuery('Непідтримуваний параметр');
  const days = positiveInteger(query.days, 30, 36500);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = calendarDate(query.dateFrom) || new Date(today.getTime() - (days - 1) * 86400000);
  const endDay = calendarDate(query.dateTo) || today;
  if (start > endDay) badQuery('Дата початку пізніша за дату завершення');
  return {
    range: { start, end: new Date(endDay.getTime() + 86400000 - 1), days },
    driverId: positiveInteger(query.driverId, null),
    page: positiveInteger(query.page, 1, 1000000),
    pageSize: positiveInteger(query.pageSize, 50, 100),
  };
}
function ownOrderWhere(user, id) {
  if (!Number.isSafeInteger(Number(user?.id)) || Number(user.id) <= 0) throw new Error('Authenticated user is required');
  const where = { customerId: Number(user.id) };
  if (id !== undefined) where.id = positiveInteger(id, undefined);
  return where;
}
function requireDispatcher(req, res, next) {
  if (!req.user?.isDispatcher) return res.status(403).send('Потрібне право диспетчера');
  return next();
}
module.exports = { parseDispatcherQuery, ownOrderWhere, requireDispatcher, positiveInteger };
