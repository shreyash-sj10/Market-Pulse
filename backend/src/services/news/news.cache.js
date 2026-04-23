/**
 * NEWS CACHE LAYER
 * TTL: 15 minutes
 */
const cache = new Map();
const TTL = 15 * 60 * 1000;

const getItems = (symbol) => {
  const entry = cache.get(symbol);
  if (entry && (Date.now() - entry.timestamp) < TTL) {
    return entry.data;
  }
  return null;
};

const setItems = (symbol, data) => {
  cache.set(symbol, {
    data,
    timestamp: Date.now()
  });
};

const clearOldCache = () => {
    for (const [key, value] of cache.entries()) {
        if (Date.now() - value.timestamp > TTL) {
            cache.delete(key);
        }
    }
};

// Activate automatic eviction every 15 minutes
const evictionTimer = setInterval(clearOldCache, TTL);
if (typeof evictionTimer.unref === "function") {
  evictionTimer.unref();
}

module.exports = { getItems, setItems, clearOldCache };
