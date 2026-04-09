const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again in 15 minutes." },
});

const { register, login, refresh } = require("../controllers/auth.controller");
const { authSchema } = require("../validations/auth.schema");
const { validateData } = require("../validations/trade.schema");

router.post("/register", authLimiter, validateData(authSchema), register);
router.post("/login", authLimiter, validateData(authSchema), login);
router.post("/refresh", refresh);
module.exports = router;
