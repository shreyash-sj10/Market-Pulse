let redisAvailable = true;
let warned = false;

const setRedisDown = () => {
  redisAvailable = false;

  // Use a throttle to prevent spam even if reset multiple times
  if (!warned) {
    console.warn("⚠ Redis unavailable — running in degraded mode");
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
