// src/controllers/driverProfileController.js
"use strict";

const path = require("path");
const DriverProfile = require("../models/driverProfile");
const User = require("../models/user");

// ─── helpers ──────────────────────────────────────────────────────────────────
const toBool = (v) => v === true || v === "true" || v === "1" || v === 1 || v === "on";
const toInt = (v) => (v === "" || v == null ? null : Number.parseInt(v, 10));
const pathToUrl = (p) => (p ? p.replace(/^.*[\\/]uploads[\\/]/, "/uploads/") : null);

// залишає у patch тільки дозволені ключі
function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

// Мапінг полів, які приймаємо з тіла + типізація
function makePatch(body) {
  const patch = pick(body, [
    "fullName",
    "inn",
    "passportSeries",
    "passportNumber",
    "driverLicenseSeries",
    "driverLicenseNumber",
    "vehicleTechSeries",
    "vehicleTechNumber",
    "carMake",
    "carModel",
    "carPlate",
  ]);

  if (body.noInn !== undefined) patch.noInn = toBool(body.noInn);

  // числа
  if (body.carYear !== undefined) patch.carYear = toInt(body.carYear);
  if (body.carLengthMm !== undefined) patch.carLengthMm = toInt(body.carLengthMm);
  if (body.carWidthMm !== undefined) patch.carWidthMm = toInt(body.carWidthMm);
  if (body.carHeightMm !== undefined) patch.carHeightMm = toInt(body.carHeightMm);

  // якщо noInn=false — чистимо inn
  if (patch.noInn === true) patch.inn = null;
  return patch;
}

// Записуємо шляхи завантажених файлів у поля профілю
function applyFiles(patch, files) {
  if (!files) return;

  const map = [
    "innDocPhoto",
    "passportPhotoMain",
    "passportPhotoRegistration",
    "driverLicensePhoto",
    "vehicleTechPhoto",
    "carPhotoFrontRight",
    "carPhotoRearLeft",
    "carPhotoInterior",
    "selfiePhoto",
  ];

  for (const key of map) {
    const f = files[key]?.[0];
    if (f?.path) patch[key] = pathToUrl(f.path);
  }
}

// ─── controllers ──────────────────────────────────────────────────────────────

// GET /driver-profile/me
exports.getMe = async (req, res) => {
  try {
    const profile = await DriverProfile.findOne({
      where: { userId: req.user.id },
      include: [{ model: User, as: "user", attributes: ["id", "email", "role"] }],
    });
    return res.json(profile || null);
  } catch (e) {
    console.error("[driverProfile.getMe]", e);
    return res.status(400).send("Не вдалося отримати профіль");
  }
};

// POST/PUT /driver-profile/me  (upsert)
exports.upsertMe = async (req, res) => {
  try {
    // (не нав’язуюсь, але зазвичай профіль редагує саме DRIVER/BOTH — це краще контролювати в authorize([...]))
    const body = req.body || {};
    const patch = makePatch(body);
    applyFiles(patch, req.files);

    let profile = await DriverProfile.findOne({ where: { userId: req.user.id } });

    if (!profile) {
      profile = await DriverProfile.create({ userId: req.user.id, ...patch });
    } else {
      Object.entries(patch).forEach(([k, v]) => {
        if (v !== undefined) profile[k] = v;
      });
      await profile.save();
    }

    // повернемо свіже значення з користувачем
    const fresh = await DriverProfile.findOne({
      where: { userId: req.user.id },
      include: [{ model: User, as: "user", attributes: ["id", "email", "role"] }],
    });
console.log(fresh);
    return res.json(fresh);
  } catch (e) {
    console.error("[driverProfile.upsertMe]", e);
    return res.status(400).send("Не вдалося зберегти профіль");
  }
};

