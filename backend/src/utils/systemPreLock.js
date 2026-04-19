const redisClient = require("./redisClient");

/**
 * Optional Redis SET NX — reduces duplicate DB work when multiple workers tick together.
 * Returns true when Redis is off/unready (caller proceeds) or lock acquired.
 */
async function acquirePreLock(key, ttlSeconds = 60) {
  if (!redisClient || redisClient.status !== "ready") return true;
  try {
    const result = await redisClient.set(key, "1", "NX", "EX", ttlSeconds);
    return result === "OK";
  } catch {
    return true;
  }
}

module.exports = { acquirePreLock };
