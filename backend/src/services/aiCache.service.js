/**
 * AI CACHE SERVICE — PRODUCTION GRADE
 * Redis-backed caching + distributed circuit breaker.
 * Circuit state shared across all instances via Redis INCR + TTL.
 */
const logger = require("../utils/logger");
const redisClient = require("../utils/redisClient");

const redisReady = () => Boolean(redisClient && redisClient.status === "ready");

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
  if (!redisReady()) return _inProcCircuitOpenUntil > Date.now();
  try {
    const open = await redisClient.get("ai:circuit_open");
    return open === "1";
  } catch {
    return false;
  }
};

const recordAIFailure = async () => {
  if (!redisReady()) {
    _inProcFailures += 1;
    if (_inProcFailures >= FAILURE_THRESHOLD) {
      _inProcCircuitOpenUntil = Date.now() + CIRCUIT_TTL_SECONDS * 1000;
      _inProcFailures = 0;
    }
    return;
  }
  try {
    const count = await redisClient.incr("ai:failures");
    await redisClient.expire("ai:failures", FAILURE_WINDOW_SECONDS);
    if (count >= FAILURE_THRESHOLD) {
      await redisClient.set("ai:circuit_open", "1", "EX", CIRCUIT_TTL_SECONDS);
      logger.warn(`AI circuit breaker opened after ${count} failures (${CIRCUIT_TTL_SECONDS}s cooldown)`);
    }
  } catch {
    // non-fatal
  }
};

const recordAISuccess = async () => {
  if (!redisReady()) {
    _inProcFailures = 0;
    _inProcCircuitOpenUntil = 0;
    return;
  }
  try {
    await redisClient.del("ai:failures");
    await redisClient.del("ai:circuit_open");
  } catch {
    // non-critical
  }
};

// ─── CACHE GET / SET ──────────────────────────────────────────────────────────

const acquireLock = async (_key) => {
  if (!redisReady()) return true; // Fail open when Redis not configured
  try {
    const lockKey = `lock:${_key}`;
    const lock = await redisClient.set(lockKey, "1", "NX", "EX", 15);
    return !!lock;
  } catch {
    return true; // Fail open
  }
};

const getCachedAI = async (key) => {
  if (!redisReady()) return null;
  try {
    const cached = await redisClient.get(`ai:${key}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const setCachedAI = async (key, value, ttlSeconds) => {
  if (!redisReady()) return;
  // RULE: Never cache UNAVAILABLE or null responses
  if (!value || value.status === "UNAVAILABLE") return;
  if (ttlSeconds === "permanent") return;
  try {
    if (ttlSeconds) {
      await redisClient.set(`ai:${key}`, JSON.stringify(value), "EX", ttlSeconds);
    } else {
      await redisClient.set(`ai:${key}`, JSON.stringify(value));
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
