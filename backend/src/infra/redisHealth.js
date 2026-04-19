const logger = require("../utils/logger");

let redisAvailable = true;
let warned = false;

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
    
    // Auto-reset warned flag after 5 mins to allow periodic "still down" reminders
    setTimeout(() => { warned = false; }, 5 * 60 * 1000);
  }
};

const setRedisUp = () => {
  redisAvailable = true;
  warned = false;
};

const isRedisAvailable = () => redisAvailable;

module.exports = {
  setRedisDown,
  setRedisUp,
  isRedisAvailable,
};
