const redisClient = require("./redisClient");
const { SYSTEM_CONFIG } = require("../config/system.config");

const memory = new Map();

const hotTtlSec = () =>
  Math.max(1, Math.ceil((SYSTEM_CONFIG.marketData.quoteCacheTtlMs || 30000) / 1000));

const staleTtlSec = () =>
  Math.max(60, Math.ceil(Number(process.env.MARKET_STALE_TTL_SEC || 30 * 60)));

const memKey = (k) => k;

const parseJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Cross-instance quote cache (Redis when USE_REDIS) with in-memory fallback.
 * Writes both HOT (short TTL) and STALE (long TTL) tiers for graceful degradation.
 */
async function getQuoteCache(symbolKey) {
  const key = String(symbolKey || "").toUpperCase();
  if (!key) return null;

  if (redisClient && redisClient.status === "ready") {
    try {
      const hot = await redisClient.get(`mq:hot:${key}`);
      if (hot) {
        const data = parseJson(hot);
        if (data) return { tier: "HOT", data };
      }
      const stale = await redisClient.get(`mq:stale:${key}`);
      if (stale) {
        const data = parseJson(stale);
        if (data) return { tier: "STALE", data };
      }
    } catch {
      /* fall through */
    }
  }

  const m = memory.get(memKey(key));
  if (!m) return null;
  const age = Date.now() - m.ts;
  if (m.tier === "hot" && age < (SYSTEM_CONFIG.marketData.quoteCacheTtlMs || 30000)) {
    return { tier: "HOT", data: m.data };
  }
  if (m.tier === "stale" && age < staleTtlSec() * 1000) {
    return { tier: "STALE", data: m.data };
  }
  return null;
}

async function setQuoteCache(symbolKey, data) {
  const key = String(symbolKey || "").toUpperCase();
  if (!key || !data) return;

  const payload = JSON.stringify(data);

  if (redisClient && redisClient.status === "ready") {
    try {
      await redisClient.set(`mq:hot:${key}`, payload, "EX", hotTtlSec());
      await redisClient.set(`mq:stale:${key}`, payload, "EX", staleTtlSec());
    } catch {
      /* non-fatal */
    }
  }

  memory.set(memKey(key), { data, ts: Date.now(), tier: "hot" });
}

module.exports = {
  getQuoteCache,
  setQuoteCache,
};
