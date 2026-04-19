/**
 * AI CACHE SERVICE — PRODUCTION GRADE
 * Redis-backed caching + distributed circuit breaker.
 * Circuit state shared across all instances via Redis INCR + TTL.
 */
const IORedis = require("ioredis");
const logger = require("../utils/logger");

const useRedis = process.env.USE_REDIS === "true";

const redis = useRedis
  ? new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 500, 10000),
    })
  : null;

if (redis) {
  redis.on("error", (err) => {
    logger.error({ action: "AI_REDIS_ERROR", error: err.message });
  });
}

// ─── DISTRIBUTED CIRCUIT BREAKER (Redis-backed) ───────────────────────────────
// Key: ai:failures        → INCR counter with auto-expiry reset
// Key: ai:circuit_open    → flag set when threshold breached, expires in 60s
const FAILURE_THRESHOLD = 5;
const CIRCUIT_TTL_SECONDS = 60;
const FAILURE_WINDOW_SECONDS = 120; // failures counted within 2 min window

// In-process fallback circuit breaker used when Redis is unavailable.
let _inProcFailures = 0;
let _inProcCircuitOpenUntil = 0;

const isCircuitOpen = async () => {
  if (!redis) return _inProcCircuitOpenUntil > Date.now();
  try {
    const open = await redis.get("ai:circuit_open");
    return open === "1";
  } catch {
    return false;
  }
};

const recordAIFailure = async () => {
  if (!redis) {
    _inProcFailures += 1;
    if (_inProcFailures >= FAILURE_THRESHOLD) {
      _inProcCircuitOpenUntil = Date.now() + CIRCUIT_TTL_SECONDS * 1000;
      _inProcFailures = 0;
    }
    return;
  }
  try {
    const count = await redis.incr("ai:failures");
    await redis.expire("ai:failures", FAILURE_WINDOW_SECONDS);
    if (count >= FAILURE_THRESHOLD) {
      await redis.set("ai:circuit_open", "1", "EX", CIRCUIT_TTL_SECONDS);
      logger.warn(`AI circuit breaker opened after ${count} failures (${CIRCUIT_TTL_SECONDS}s cooldown)`);
    }
  } catch {
    // non-fatal
  }
};

const recordAISuccess = async () => {
  if (!redis) {
    _inProcFailures = 0;
    _inProcCircuitOpenUntil = 0;
    return;
  }
  try {
    await redis.del("ai:failures");
    await redis.del("ai:circuit_open");
  } catch {
    // non-critical
  }
};

// ─── CACHE GET / SET ──────────────────────────────────────────────────────────

const acquireLock = async (_key) => {
  if (!redis) return true; // Fail open when Redis not configured
  try {
    const lockKey = `lock:${_key}`;
    const lock = await redis.set(lockKey, "1", "NX", "EX", 15);
    return !!lock;
  } catch {
    return true; // Fail open
  }
};

const getCachedAI = async (key) => {
  if (!redis) return null;
  try {
    const cached = await redis.get(`ai:${key}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const setCachedAI = async (key, value, ttlSeconds) => {
  if (!redis) return;
  // RULE: Never cache UNAVAILABLE or null responses
  if (!value || value.status === "UNAVAILABLE") return;
  if (ttlSeconds === "permanent") return;
  try {
    if (ttlSeconds) {
      await redis.set(`ai:${key}`, JSON.stringify(value), "EX", ttlSeconds);
    } else {
      await redis.set(`ai:${key}`, JSON.stringify(value));
    }
  } catch {
    // non-critical
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
