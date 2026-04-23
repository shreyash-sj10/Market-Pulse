const logger = require("../utils/logger");

let redisAvailable = false;
let warned = false;
let warnedResetTimer = null;

const setRedisDown = () => {
  redisAvailable = false;

  // Use a throttle to prevent spam even if reset multiple times
  if (!warned) {
    logger.warn({
      service: "redisHealth",
      step: "REDIS_UNAVAILABLE",
      status: "WARN",
      data: { message: "Redis unavailable — degraded mode" },
      timestamp: new Date().toISOString(),
    });
    warned = true;
    
    // Auto-reset warned flag after 5 mins to allow periodic "still down" reminders.
    // Unref timer so it never blocks process shutdown in tests.
    if (warnedResetTimer) {
      clearTimeout(warnedResetTimer);
    }
    warnedResetTimer = setTimeout(() => {
      warned = false;
      warnedResetTimer = null;
    }, 5 * 60 * 1000);
    if (typeof warnedResetTimer.unref === "function") {
      warnedResetTimer.unref();
    }
  }
};

const setRedisUp = () => {
  redisAvailable = true;
  warned = false;
  if (warnedResetTimer) {
    clearTimeout(warnedResetTimer);
    warnedResetTimer = null;
  }
};

const isRedisAvailable = () => redisAvailable;

module.exports = {
  setRedisDown,
  setRedisUp,
  isRedisAvailable,
};
