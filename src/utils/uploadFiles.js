"use strict";

const fs = require("fs/promises");
const path = require("path");

const UPLOADS_PREFIX = "/uploads/";
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
const UPLOADS_DIR_WITH_SEP = `${UPLOADS_DIR}${path.sep}`;

function pathToUploadUrl(filePath) {
  if (!filePath || typeof filePath !== "string") return null;
  return filePath.replace(/^.*[\\/]uploads[\\/]/, UPLOADS_PREFIX);
}

function uploadUrlToAbsolutePath(uploadUrl) {
  if (!uploadUrl || typeof uploadUrl !== "string") return null;
  const normalized = uploadUrl.replace(/\\/g, "/");
  const idx = normalized.indexOf(UPLOADS_PREFIX);
  if (idx === -1) return null;
  const relativeRaw = normalized.slice(idx + UPLOADS_PREFIX.length);
  if (!relativeRaw) return null;
  const relative = decodeURIComponent(relativeRaw);
  const abs = path.resolve(UPLOADS_DIR, relative);
  if (abs !== UPLOADS_DIR && !abs.startsWith(UPLOADS_DIR_WITH_SEP)) return null;
  return abs;
}

async function deleteUploadByUrl(uploadUrl) {
  const absPath = uploadUrlToAbsolutePath(uploadUrl);
  if (!absPath) return false;
  try {
    await fs.unlink(absPath);
    return true;
  } catch (err) {
    if (err && err.code === "ENOENT") return false;
    throw err;
  }
}

function collectUploadedUrls(multerPayload) {
  const urls = [];
  if (!multerPayload) return urls;

  if (Array.isArray(multerPayload)) {
    for (const file of multerPayload) {
      const url = pathToUploadUrl(file?.path);
      if (url) urls.push(url);
    }
    return urls;
  }

  if (multerPayload.path) {
    const url = pathToUploadUrl(multerPayload.path);
    if (url) urls.push(url);
    return urls;
  }

  for (const files of Object.values(multerPayload)) {
    if (!Array.isArray(files)) continue;
    for (const file of files) {
      const url = pathToUploadUrl(file?.path);
      if (url) urls.push(url);
    }
  }

  return urls;
}

async function cleanupUploadUrls(urls) {
  const uniqueUrls = [...new Set((urls || []).filter(Boolean))];
  await Promise.allSettled(uniqueUrls.map((url) => deleteUploadByUrl(url)));
}

module.exports = {
  pathToUploadUrl,
  collectUploadedUrls,
  cleanupUploadUrls,
  deleteUploadByUrl,
};
