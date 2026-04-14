const express = require("express");
const router = express.Router();

const protect = require("../middlewares/auth.middleware");
const { getMe, getProfile } = require("../controllers/user.controller");

router.get("/me", protect, getMe);
router.get("/profile", protect, getProfile);

module.exports = router;
