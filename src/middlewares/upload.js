const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const { randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream');
const { beginUploadWriter } = require('../services/uploadWriter');
const storage = {
  async _handleFile(req, file, cb) {
    const filename = `${randomUUID()}${path.extname(file.originalname || '.jpg')}`;
    const filePath = path.join(uploadDir, filename);
    let writer;
    try {
      if (req.user?.id) writer = await beginUploadWriter(req.user.id, `/uploads/${filename}`);
    } catch (error) { cb(error); return; }
    const output = fs.createWriteStream(filePath);
    const abortFile = () => output.destroy(new Error('Upload request aborted'));
    req.once('aborted', abortFile);
    pipeline(file.stream, output, async error => {
      req.removeListener('aborted', abortFile);
      try {
        // pipeline is finished/closed before unlocking, including aborted requests.
        if (writer) await writer.finish();
        if (error) { cb(error); return; }
        cb(null, {destination: uploadDir, filename, path: filePath, size: output.bytesWritten});
      } catch (finishError) { cb(finishError); }
    });
    if (writer) writer.setAbort(error => output.destroy(error));
    if (req.aborted) abortFile();
  },
  _removeFile(_req, file, cb) { fs.unlink(file.path, cb); },
};
const upload = multer({ storage });

/**
 * Приймаємо усі поля із фото з анкети водія
 */
const driverProfileFiles = upload.fields([
  { name: "innDocPhoto", maxCount: 1 },
  { name: "passportPhotoMain", maxCount: 1 },
  { name: "passportPhotoRegistration", maxCount: 1 },
  { name: "driverLicensePhoto", maxCount: 1 },
  { name: "vehicleTechPhoto", maxCount: 1 },
  { name: "carPhotoFrontRight", maxCount: 1 },
  { name: "carPhotoRearLeft", maxCount: 1 },
  { name: "carPhotoInterior", maxCount: 1 },
  { name: "selfiePhoto", maxCount: 1 },
]);

const profileSelfieOnly = upload.single("selfiePhoto");

module.exports = { upload, driverProfileFiles, profileSelfieOnly };
