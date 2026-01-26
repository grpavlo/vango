const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || ".jpg");
    cb(null, unique + ext);
  },
});

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

module.exports = { upload, driverProfileFiles };
