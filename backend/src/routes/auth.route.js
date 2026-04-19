const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redisClient = require("../utils/redisClient");

/**
 * Conditionally attach a Redis store if Redis is enabled (USE_REDIS=true).
 * The sendCommand closure is evaluated lazily per-request, so transient Redis
 * outages fail open (in-memory fallback inside express-rate-limit) rather than
 * hard-failing the auth routes.
 * This mirrors the pattern already used in trade.route.js.
 */
const buildRedisStore = (prefix) =>
  redisClient
    ? {
        store: new RedisStore({
          sendCommand: (...args) => redisClient.call(...args),
          prefix,
        }),
      }
    : {};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again in 15 minutes." },
  ...buildRedisStore("rl:auth:"),
});

// Lighter limiter for token refresh — still needs protection against hammering.
// Higher cap than login/register because legitimate auto-refresh flows hit this frequently.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many refresh requests." },
  ...buildRedisStore("rl:refresh:"),
});

const { register, login, refresh, logout } = require("../controllers/auth.controller");
const protect = require("../middlewares/auth.middleware");
const { authSchema } = require("../validations/auth.schema");
const { validateData } = require("../validations/trade.schema");

router.post("/register", authLimiter, validateData(authSchema), register);
router.post("/login", authLimiter, validateData(authSchema), login);
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", protect, logout);
module.exports = router;
