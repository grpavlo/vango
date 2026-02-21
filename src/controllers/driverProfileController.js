// src/controllers/driverProfileController.js
"use strict";

const db = require("../config/db");
const DriverProfile = require("../models/driverProfile");
const User = require("../models/user");
const {
  collectUploadedUrls,
  cleanupUploadUrls,
} = require("../utils/uploadFiles");

const toBool = (v) =>
  v === true || v === "true" || v === "1" || v === 1 || v === "on";
const toInt = (v) => (v === "" || v == null ? null : Number.parseInt(v, 10));
const pathToUrl = (p) => (p ? p.replace(/^.*[\\/]uploads[\\/]/, "/uploads/") : null);

const DRIVER_PROFILE_FILE_FIELDS = [
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

const hasValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "string") return value.trim().length > 0;
  return true;
};

const buildSnapshot = (profile, patch) => {
  const base = profile ? profile.get({ plain: true }) : {};
  return { ...base, ...patch };
};

function validateDriverProfile(snapshot) {
  const missing = [];
  const requireField = (condition, label) => {
    if (!condition) missing.push(label);
  };

  requireField(hasValue(snapshot.fullName), "ПІБ");

  if (snapshot.noInn) {
    requireField(hasValue(snapshot.innDocPhoto), "Фото довідки про відсутність ІПН");
  } else {
    requireField(hasValue(snapshot.inn), "ІПН");
  }

  requireField(hasValue(snapshot.passportNumber), "Номер паспорта");
  requireField(hasValue(snapshot.passportPhotoMain), "Фото паспорта (1 сторінка)");
  requireField(hasValue(snapshot.passportPhotoRegistration), "Фото паспорта (прописка)");

  requireField(hasValue(snapshot.driverLicenseNumber), "Номер посвідчення водія");
  requireField(hasValue(snapshot.driverLicensePhoto), "Фото посвідчення водія");

  requireField(hasValue(snapshot.vehicleTechNumber), "Номер техпаспорта");
  requireField(hasValue(snapshot.vehicleTechPhoto), "Фото техпаспорта");

  requireField(hasValue(snapshot.carPlate), "Державний номер");
  requireField(hasValue(snapshot.carMake), "Марка авто");
  requireField(hasValue(snapshot.carModel), "Модель авто");
  requireField(hasValue(snapshot.carYear), "Рік випуску");
  requireField(hasValue(snapshot.carLengthMm), "Довжина авто (мм)");
  requireField(hasValue(snapshot.carWidthMm), "Ширина авто (мм)");
  requireField(hasValue(snapshot.carHeightMm), "Висота авто (мм)");

  requireField(hasValue(snapshot.carPhotoFrontRight), "Фото авто (передній правий кут)");
  requireField(hasValue(snapshot.carPhotoRearLeft), "Фото авто (задній лівий кут)");
  requireField(hasValue(snapshot.carPhotoInterior), "Фото салону");
  requireField(hasValue(snapshot.selfiePhoto), "Селфі");

  if (missing.length) {
    const error = new Error(
      `Будь ласка, заповніть обов'язкові поля: ${missing.join(", ")}`
    );
    error.statusCode = 400;
    throw error;
  }
}

function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

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

  if (body.carYear !== undefined) patch.carYear = toInt(body.carYear);
  if (body.carLengthMm !== undefined) patch.carLengthMm = toInt(body.carLengthMm);
  if (body.carWidthMm !== undefined) patch.carWidthMm = toInt(body.carWidthMm);
  if (body.carHeightMm !== undefined) patch.carHeightMm = toInt(body.carHeightMm);

  if (patch.noInn === true) patch.inn = null;
  return patch;
}

function applyFiles(patch, files) {
  if (!files) return;

  for (const key of DRIVER_PROFILE_FILE_FIELDS) {
    const file = files[key]?.[0];
    if (file?.path) patch[key] = pathToUrl(file.path);
  }
}

function getReplacedPhotoUrls({ previousProfile, previousUser, patch, files }) {
  const replaced = new Set();
  for (const key of DRIVER_PROFILE_FILE_FIELDS) {
    const uploaded = files?.[key]?.[0];
    if (!uploaded?.path) continue;

    const newUrl = patch[key];
    if (!newUrl) continue;

    const oldFromProfile = previousProfile?.[key];
    if (oldFromProfile && oldFromProfile !== newUrl) {
      replaced.add(oldFromProfile);
    }

    if (key === "selfiePhoto") {
      const oldFromUser = previousUser?.selfiePhoto;
      if (oldFromUser && oldFromUser !== newUrl) {
        replaced.add(oldFromUser);
      }
    }
  }
  return [...replaced];
}

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

exports.upsertMe = async (req, res) => {
  const uploadedUrls = collectUploadedUrls(req.files);
  let shouldCleanupUploaded = true;
  let replacedUrls = [];

  try {
    await db.transaction(async (transaction) => {
      const body = req.body || {};
      const patch = makePatch(body);
      applyFiles(patch, req.files);

      const user = await User.findByPk(req.user.id, { transaction });
      if (!user) {
        const error = new Error("Користувача не знайдено");
        error.statusCode = 404;
        throw error;
      }

      if (!patch.selfiePhoto && user.selfiePhoto) {
        patch.selfiePhoto = user.selfiePhoto;
      }

      let profile = await DriverProfile.findOne({
        where: { userId: user.id },
        transaction,
      });
      const previousProfile = profile ? profile.get({ plain: true }) : null;
      const previousUser = user.get({ plain: true });

      replacedUrls = getReplacedPhotoUrls({
        previousProfile,
        previousUser,
        patch,
        files: req.files,
      });

      const snapshot = buildSnapshot(profile, patch);
      validateDriverProfile(snapshot);

      if (!profile) {
        profile = await DriverProfile.create(
          { userId: user.id, ...patch },
          { transaction }
        );
      } else {
        Object.entries(patch).forEach(([k, v]) => {
          if (v !== undefined) profile[k] = v;
        });
        await profile.save({ transaction });
      }

      if (patch.fullName) {
        const parts = String(patch.fullName).trim().split(/\s+/).filter(Boolean);
        user.firstName = parts[1] || null;
        user.lastName = parts[0] || null;
        user.patronymic = parts.length > 2 ? parts.slice(2).join(" ") : null;
        user.name = patch.fullName;
      }
      if (patch.selfiePhoto) {
        user.selfiePhoto = patch.selfiePhoto;
      }
      await user.save({ transaction });
    });

    shouldCleanupUploaded = false;
    await cleanupUploadUrls(replacedUrls);

    const fresh = await DriverProfile.findOne({
      where: { userId: req.user.id },
      include: [{ model: User, as: "user", attributes: ["id", "email", "role"] }],
    });
    return res.json(fresh);
  } catch (e) {
    if (shouldCleanupUploaded) {
      await cleanupUploadUrls(uploadedUrls);
    }
    console.error("[driverProfile.upsertMe]", e);
    if (e.statusCode) {
      return res.status(e.statusCode).send(e.message);
    }
    return res.status(400).send("Не вдалося зберегти профіль");
  }
};
