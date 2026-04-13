/**
 * AI CACHE SERVICE — PRODUCTION GRADE
 * Redis-backed caching + distributed circuit breaker.
 * Circuit state shared across all instances via Redis INCR + TTL.
 */
const IORedis = require("ioredis");
const logger = require("../lib/logger");

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
});

redis.on("error", (err) => {
  logger.error({ action: "AI_REDIS_ERROR", error: err.message });
});

// ─── DISTRIBUTED CIRCUIT BREAKER (Redis-backed) ───────────────────────────────
// Key: ai:failures        → INCR counter with auto-expiry reset
// Key: ai:circuit_open    → flag set when threshold breached, expires in 60s
const FAILURE_THRESHOLD = 5;
const CIRCUIT_TTL_SECONDS = 60;
const FAILURE_WINDOW_SECONDS = 120; // failures counted within 2 min window

const isCircuitOpen = async () => {
  try {
    const open = await redis.get("ai:circuit_open");
    return open === "1";
  } catch (err) {
    // Redis failure → fail open (AI allowed, but not cached)
    return false;
  }
};

const recordAIFailure = async () => {
  try {
    const count = await redis.incr("ai:failures");
    // Set sliding expiry on the failure counter window
    await redis.expire("ai:failures", FAILURE_WINDOW_SECONDS);

    if (count >= FAILURE_THRESHOLD) {
      await redis.set("ai:circuit_open", "1", "EX", CIRCUIT_TTL_SECONDS);
      logger.warn({
        action: "AI_CIRCUIT_BREAKER_OPENED",
        failures: count,
        duration: `${CIRCUIT_TTL_SECONDS}s`,
      });
    }
  } catch (err) {
    logger.error({ action: "AI_CIRCUIT_RECORD_ERROR", error: err.message });
  }
};

const recordAISuccess = async () => {
  try {
    await redis.del("ai:failures");
    await redis.del("ai:circuit_open");
  } catch (err) {
    // Non-critical — don't block on cleanup
  }
};

// ─── CACHE GET / SET ──────────────────────────────────────────────────────────

const acquireLock = async (key) => {
  try {
    const lockKey = `lock:${key}`;
    const lock = await redis.set(lockKey, "1", "NX", "EX", 15);
    return !!lock;
  } catch (err) {
    logger.error({ action: "AI_LOCK_ERROR", error: err.message });
    return true; // Fail open
  }
};

const getCachedAI = async (key) => {
  try {
    const _start = Date.now();
    const cached = await redis.get(`ai:${key}`);
    if (cached) {
      const type = key.split(":")[0];
      logger.info({ action: "AI_CACHE_HIT", type, latencyMs: Date.now() - _start });
      return JSON.parse(cached);
    }
    const type = key.split(":")[0];
    logger.info({ action: "AI_CACHE_MISS", type });
    return null;
  } catch (err) {
    logger.error({ action: "AI_CACHE_GET_ERROR", error: err.message });
    return null;
  }
};

const setCachedAI = async (key, value, ttlSeconds) => {
  try {
    // RULE: Never cache UNAVAILABLE or null responses
    if (!value || value.status === "UNAVAILABLE") return;

    if (ttlSeconds === "permanent") {
      // Reflection data is persisted to MongoDB — skip Redis for permanent records
      return;
    }

    if (ttlSeconds) {
      await redis.set(`ai:${key}`, JSON.stringify(value), "EX", ttlSeconds);
    } else {
      await redis.set(`ai:${key}`, JSON.stringify(value));
    }
  } catch (err) {
    logger.error({ action: "AI_CACHE_SET_ERROR", error: err.message });
  }
};

module.exports = {
  getCachedAI,
  setCachedAI,
  isCircuitOpen,
  recordAIFailure,
  recordAISuccess,
  acquireLock,
};
