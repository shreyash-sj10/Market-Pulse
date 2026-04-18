const IORedis = require("ioredis");
const logger = require("./logger");
const { setRedisDown, setRedisUp } = require("../infra/redisHealth");

/**
 * CENTRALIZED REDIS CLIENT (Production Hardening)
 *
 * Supports USE_REDIS flag for local development fallbacks.
 * Unifies connection logic for BullMQ and Authority Stores.
 */

const useRedis = process.env.USE_REDIS === "true";
let redisClient = null;
const FALLBACK_MODE = "DEGRADED_SYNC_FALLBACK";

if (useRedis) {
  redisClient = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableOfflineQueue: false, // Prevents command buffering if Redis is actually down
    connectTimeout: 5000,
  });

  redisClient.on("ready", () => {
    setRedisUp();
    logger.info("Redis link established — Subsystems operational.");
  });

  redisClient.on("error", (err) => {
    setRedisDown();
    logger.warn(`Redis runtime error (${err.code || "UNKNOWN"}): ${err.message}. Fallback mode=${FALLBACK_MODE}`);
  });

  // Startup health check: verify both connect and ping, then degrade safely if unavailable.
  const verifyStartupConnection = async () => {
    try {
      await redisClient.connect();
      await redisClient.ping();
      setRedisUp();
      logger.info("Redis startup check passed.");
    } catch (err) {
      setRedisDown();
      logger.warn(`Redis startup check failed (${err.code || "UNKNOWN"}): ${err.message}. Fallback mode=${FALLBACK_MODE}`);
    }
  };

  verifyStartupConnection().catch(() => {
    setRedisDown();
    logger.warn(`Redis startup check crashed unexpectedly. Fallback mode=${FALLBACK_MODE}`);
  });
} else {
  // If Redis is explicitly disabled via env
  setRedisDown();
  logger.info(`Redis disabled via USE_REDIS=false — Fallback mode=${FALLBACK_MODE}.`);
}

module.exports = redisClient;
