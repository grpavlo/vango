const CODE_TTL_MS = 5 * 60 * 1000; // 5 хвилин

const store = new Map();

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

module.exports = { generateCode, set, get, verifyAndConsume, normalizePhone };
