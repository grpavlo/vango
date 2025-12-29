// src/routes/driverProfile.js
const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const { driverProfileFiles } = require("../middlewares/upload"); // multer.fields(...) як ми обговорювали
const ctrl = require("../controllers/driverProfileController");

// Дивитись ролі під свою логіку:
router.get("/driver-profile/me", authenticate, authorize(["DRIVER", "CUSTOMER", "BOTH"]), ctrl.getMe);
router.post("/driver-profile/me", authenticate, authorize(["DRIVER", "BOTH"]), driverProfileFiles, ctrl.upsertMe);
router.put("/driver-profile/me", authenticate, authorize(["DRIVER", "BOTH"]), driverProfileFiles, ctrl.upsertMe);


module.exports = router;
