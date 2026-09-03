const CODE_TTL_MS = 5 * 60 * 1000; // 5 хвилин

const store = new Map();
const DEFAULT_DEV_AUTH_CODE = '111111';

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? '38' + digits : (digits.startsWith('38') ? digits : '38' + digits);
}

function set(phone, code) {
  const key = normalizePhone(phone);
  store.set(key, { code, expiresAt: Date.now() + CODE_TTL_MS });
}

function get(phone) {
  const key = normalizePhone(phone);
  const entry = store.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.code;
}

function verifyAndConsume(phone, code) {
  const stored = get(phone);
  if (!stored || stored !== String(code).trim()) return false;
  store.delete(normalizePhone(phone));
  return true;
}

function canUseDevAuthCode() {
  return process.env.NODE_ENV !== 'production'
    && process.env.DISABLE_DEV_SMS_FALLBACK !== 'true'
    && process.env.DEV_SMS_BYPASS !== '0';
}

function getDevAuthCode() {
  if (!canUseDevAuthCode()) return null;
  const configured = String(process.env.DEV_AUTH_CODE || DEFAULT_DEV_AUTH_CODE).trim();
  return /^\d{6}$/.test(configured) ? configured : DEFAULT_DEV_AUTH_CODE;
}

function verifyAndConsumeOrDev(phone, code) {
  if (verifyAndConsume(phone, code)) return true;
  const devCode = getDevAuthCode();
  return Boolean(devCode && String(code).trim() === devCode);
}

module.exports = {
  generateCode,
  set,
  get,
  verifyAndConsume,
  verifyAndConsumeOrDev,
  normalizePhone,
  getDevAuthCode,
};
