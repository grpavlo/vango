const SavedSearch = require('../models/savedSearch');

function normalizeCity(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

function sameOptionalNumber(a, b, epsilon = 0.0001) {
  const aNum = normalizeOptionalNumber(a);
  const bNum = normalizeOptionalNumber(b);
  if (aNum === null && bNum === null) return true;
  if (!Number.isFinite(aNum) || !Number.isFinite(bNum)) return false;
  return Math.abs(aNum - bNum) < epsilon;
}

async function listSavedSearches(req, res) {
  const searches = await SavedSearch.findAll({
    where: { driverId: req.user.id },
    order: [['createdAt', 'DESC']],
  });
  res.json(searches);
}

async function createSavedSearch(req, res) {
  const pickupCity = String(req.body?.pickupCity || '').trim();
  const dropoffCity = String(req.body?.dropoffCity || '').trim();
  const lat = Number(req.body?.lat);
  const lon = Number(req.body?.lon);
  const dropoffLat = normalizeOptionalNumber(req.body?.dropoffLat);
  const dropoffLon = normalizeOptionalNumber(req.body?.dropoffLon);
  const radius = Number(req.body?.radius);

  if (!pickupCity) {
    return res.status(400).send('Вкажіть місто завантаження');
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).send('Не вдалося визначити координати для пошуку');
  }
  if (
    (req.body?.dropoffLat != null || req.body?.dropoffLon != null) &&
    (!Number.isFinite(dropoffLat) || !Number.isFinite(dropoffLon))
  ) {
    return res
      .status(400)
      .send('Не вдалося визначити координати місця розвантаження');
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    return res.status(400).send('Вкажіть коректний радіус');
  }

  try {
    const normalizedPickupCity = normalizeCity(pickupCity);
    const normalizedDropoffCity = normalizeCity(dropoffCity);
    const existing = await SavedSearch.findAll({
      where: { driverId: req.user.id },
    });

    const duplicate = existing.find(
      (item) =>
        normalizeCity(item.pickupCity) === normalizedPickupCity &&
        normalizeCity(item.dropoffCity) === normalizedDropoffCity &&
        Math.abs(Number(item.lat) - lat) < 0.0001 &&
        Math.abs(Number(item.lon) - lon) < 0.0001 &&
        sameOptionalNumber(item.dropoffLat, dropoffLat) &&
        sameOptionalNumber(item.dropoffLon, dropoffLon) &&
        Math.abs(Number(item.radius) - radius) < 0.01
    );
    if (duplicate) {
      return res.json(duplicate);
    }

    const saved = await SavedSearch.create({
      driverId: req.user.id,
      pickupCity,
      dropoffCity: dropoffCity || null,
      lat,
      lon,
      dropoffLat,
      dropoffLon,
      radius,
    });

    res.status(201).json(saved);
  } catch (err) {
    res.status(400).send('Не вдалося зберегти критерій пошуку');
  }
}

async function deleteSavedSearch(req, res) {
  const saved = await SavedSearch.findOne({
    where: { id: req.params.id, driverId: req.user.id },
  });
  if (!saved) {
    return res.status(404).send('Критерій не знайдено');
  }
  await saved.destroy();
  res.json({ message: 'Критерій видалено' });
}

module.exports = {
  listSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
};
