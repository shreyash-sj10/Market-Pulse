const express = require("express");
const router = express.Router();

const protect = require("../middlewares/auth.middleware");
const { getMe } = require("../controllers/user.controller");

router.get("/me", protect, getMe);

module.exports = router;
