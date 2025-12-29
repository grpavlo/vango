function parseDate(value) {
  if (!value) return null;
  let parsed;
  if (typeof value === 'string' && value.includes('.')) {
    const parts = value.split('.');
    if (parts.length === 2) {
      const [d, m] = parts.map(Number);
      if (!isNaN(d) && !isNaN(m)) {
        const y = new Date().getFullYear();
        parsed = new Date(y, m - 1, d);
      }
    } else if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        parsed = new Date(y, m - 1, d);
      }
    }
  }
  if (!parsed) {
    const tmp = new Date(value);
    if (!isNaN(tmp)) parsed = tmp;
  }
  return parsed || null;
}

module.exports = { parseDate };
