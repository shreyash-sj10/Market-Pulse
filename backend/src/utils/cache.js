/**
 * INTELLIGENCE CACHE UTILITY
 * Implements 5-minute bucketed caching for high-frequency intelligence endpoints.
 */
const cache = new Map();

const getBucketKey = (category, symbol) => {
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return `${category}:${symbol || "GENERAL"}:${bucket}`;
};

exports.get = (category, symbol) => {
  const key = getBucketKey(category, symbol);
  const entry = cache.get(key);
  
  if (entry) {
    console.log(`[CACHE HIT] ${category} - ${symbol || "GENERAL"}`);
    return entry;
  }
  
  console.log(`[CACHE MISS] ${category} - ${symbol || "GENERAL"}`);
  return null;
};

exports.set = (category, symbol, data) => {
  const key = getBucketKey(category, symbol);
  // Clear old entries for this category/symbol to keep memory clean
  // (In a real system, we might use a proper TTL-based cache like lru-cache)
  cache.set(key, data);
};
