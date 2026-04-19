const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { mergeTraceUser } = require("../context/traceContext");
const redisClient = require("../utils/redisClient");
const logger = require("../utils/logger");

const USER_CACHE_TTL_S = Number(process.env.AUTH_USER_CACHE_TTL_S || 30);
const USER_CACHE_PREFIX = "auth:uc:";

/**
 * Fields safe to cache: identity + metadata only. Balance is NOT cached here
 * because the trade service re-reads the user inside every transaction.
 * A 30s stale balance on req.user is acceptable — financial operations never
 * trust req.user.balance for the final debit/credit decision.
 */
const SAFE_USER_FIELDS = [
  "_id", "id", "name", "email", "role",
  "systemStateVersion", "createdAt",
];

const buildCacheKey = (userId) => `${USER_CACHE_PREFIX}${userId}`;

/** Write a minimal user snapshot to Redis. Falls back silently on any error. */
const cacheUser = async (userId, userDoc) => {
  if (!redisClient || redisClient.status !== "ready") return;
  try {
    const payload = {};
    for (const f of SAFE_USER_FIELDS) {
      if (userDoc[f] !== undefined) payload[f] = userDoc[f];
    }
    await redisClient.set(
      buildCacheKey(userId),
      JSON.stringify(payload),
      "EX",
      USER_CACHE_TTL_S
    );
  } catch (e) {
    logger.warn({ event: "AUTH_CACHE_WRITE_FAIL", userId, message: e?.message });
  }
};

/** Read cached user from Redis. Returns null on miss, error, or Redis unavailable. */
const getCachedUser = async (userId) => {
  if (!redisClient || redisClient.status !== "ready") return null;
  try {
    const raw = await redisClient.get(buildCacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    logger.warn({ event: "AUTH_CACHE_READ_FAIL", userId, message: e?.message });
    return null;
  }
};

/**
 * Invalidate the cached user entry. Call this after any operation that mutates
 * user identity fields (login, logout, profile update).
 * Balance-changing operations (trade execution) do NOT need to invalidate
 * because the cached object intentionally omits balance.
 */
const invalidateUserCache = async (userId) => {
  if (!redisClient || redisClient.status !== "ready") return;
  try {
    await redisClient.del(buildCacheKey(userId));
  } catch (e) {
    logger.warn({ event: "AUTH_CACHE_INVALIDATE_FAIL", userId, message: e?.message });
  }
};

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.tokenType !== "access") {
        return next(new AppError("Not authorized, invalid token type", 401));
      }

      const userId = decoded.userId;

      // Fast path: serve from Redis cache when available.
      // The cached object has identity fields only — balance-sensitive routes
      // re-read the user inside their own DB queries.
      const cached = await getCachedUser(userId);
      if (cached && cached._id) {
        req.user = cached;
        mergeTraceUser(cached._id);
        return next();
      }

      // Slow path: fetch from DB, then warm the cache.
      // .lean() returns a plain JS object — faster and sufficient for auth middleware.
      // Financial operations re-fetch inside their own transactions and never rely on req.user.
      const user = await User.findById(userId).select("-password").lean();
      if (!user) {
        return next(new AppError("Not authorized, user not found", 401));
      }

      // Warm cache for subsequent requests in this auth window.
      cacheUser(userId, user).catch(() => {});

      req.user = user;
      mergeTraceUser(user._id);
      return next();
    } catch (error) {
      return next(new AppError("Not authorized, token failed", 401));
    }
  }

  if (!token) {
    return next(new AppError("Not authorized, token missing", 401));
  }
};

module.exports = protect;
module.exports.invalidateUserCache = invalidateUserCache;
module.exports.cacheUser = cacheUser;
