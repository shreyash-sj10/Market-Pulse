const redisClient = require("../utils/redisClient");
const AppError = require("../utils/AppError");
const { SYSTEM_CONFIG } = require("../config/system.config");
const { getLivePriceFromYahoo } = require("./providers/yahoo.provider");
const { normalizeSymbol } = require("../utils/symbol.utils");

const memoryCache = new Map();

function redisReady() {
  return Boolean(redisClient && redisClient.status === "ready");
}

function cacheTtlMs() {
  return SYSTEM_CONFIG.marketData.quoteCacheTtlMs || 30000;
}

function now() {
  return Date.now();
}

/**
 * Single execution-grade price path: Redis → memory (fresh TTL) → Yahoo → stale memory → throw.
 * No synthetic prices.
 */
async function getPrice(symbol) {
  const apiSymbol = normalizeSymbol(symbol);
  const key = `price:${apiSymbol}`;

  if (redisReady()) {
    try {
      const cached = await redisClient.get(key);
      if (cached != null && cached !== "") {
        const pricePaise = Number(cached);
        if (Number.isInteger(pricePaise) && pricePaise > 100) {
          return { pricePaise, source: "REDIS" };
        }
      }
    } catch {
      /* fall through */
    }
  }

  const mem = memoryCache.get(apiSymbol);
  const ttl = cacheTtlMs();
  if (mem && now() - mem.ts < ttl) {
    return { pricePaise: mem.pricePaise, source: "MEMORY" };
  }

  try {
    const pricePaise = await getLivePriceFromYahoo(apiSymbol);
    memoryCache.set(apiSymbol, { pricePaise, ts: now() });

    if (redisReady()) {
      try {
        const exSec = Math.max(1, Math.ceil(ttl / 1000));
        await redisClient.set(key, String(pricePaise), "EX", exSec);
      } catch {
        /* non-fatal */
      }
    }

    return { pricePaise, source: "LIVE" };
  } catch {
    if (mem && Number.isInteger(mem.pricePaise) && mem.pricePaise > 100) {
      return { pricePaise: mem.pricePaise, source: "STALE" };
    }
    throw new AppError("MARKET_DATA_UNAVAILABLE", 503);
  }
}

module.exports = {
  getPrice,
};
