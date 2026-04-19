/**
 * In-process LRU for explanation payloads when Redis is down or cold.
 * Mirrors Redis keys under same logical names for reproducibility within a process.
 */

const MAX = 320;

const cache = new Map();

const get = (key) => {
  if (!key) return null;
  const hit = cache.get(key);
  if (!hit) return null;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
};

const set = (key, value) => {
  if (!key || value == null) return;
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
};

module.exports = { get, set };
