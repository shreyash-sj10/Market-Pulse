const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const AppError = require('../utils/AppError');
const { SYSTEM_CONFIG } = require("../config/system.config");

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = SYSTEM_CONFIG.marketData.quoteCacheTtlMs;

const { toPaise, enforcePaise} = require('../utils/paise');

// Phase 7: Rate Limit Guard (Respect 5 calls/min for external sources)
const throttleDelay = 12000; // 12s per call ensures < 5 per min
let lastExternalCallTime = 0;

const respectRateLimit = async () => {
  const now = Date.now();
  const waitTime = lastExternalCallTime + throttleDelay - now;
  if (waitTime > 0) {
    console.log(`[RateLimit] Throttling external request for ${waitTime}ms...`);
    await new Promise(res => setTimeout(res, waitTime));
  }
  lastExternalCallTime = Date.now();
};

const symbolHash = (symbol = "") => {
  let h = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    h = ((h << 5) - h) + symbol.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const buildSyntheticQuote = (symbol, index = 0) => {
  const baseSymbol = (symbol || "").replace(".NS", "").replace(".BO", "");
  const h = symbolHash(baseSymbol);
  const rupeePrice = 150 + (h % 4200);
  const changePercent = Number((((h % 1200) - 600) / 100).toFixed(2));

  return {
    symbol: baseSymbol,
    fullSymbol: symbol,
    pricePaise: toPaise(rupeePrice),
    changePercent,
    volume: 500000 + ((h + index * 97) % 25000000),
    marketCap: 30000000000 + ((h % 200000) * 1000000),
    peRatio: Number((8 + (h % 3200) / 100).toFixed(1)),
    trend: changePercent > 1 ? "BULLISH" : changePercent < -1 ? "BEARISH" : "SIDEWAYS",
    lastUpdate: new Date(),
    source: "FALLBACK",
    isSynthetic: true,
    isFallback: true,
  };
};

const normalizeSymbol = (symbol) => {
  if (!symbol) return null;
  const s = symbol.toUpperCase().trim();
  if (s.endsWith('.NS') || s.endsWith('.BO')) return s;
  return `${s}.NS`;
};

/**
 * 1. UNIFIED SCHEMA MAPPING
 */
const normalizeQuote = (raw) => {
  if (!raw) return null;

  // 1. CURRENCY VALIDATION (Hard Layer)
  // Only allow INR assets to prevent valuation distortion (USD vs INR)
  if (raw.currency && raw.currency !== 'INR') {
    console.warn(`[IntegrityWall] Rejecting asset ${raw.symbol} due to currency mismatch: ${raw.currency}`);
    return null;
  }

  if (!raw.regularMarketPrice) {
    throw new Error(`MISSING_REQUIRED_FIELD:regularMarketPrice:${raw.symbol || "UNKNOWN_SYMBOL"}`);
  }

  // Support both Yahoo and generic formats
  return {
    symbol: (raw.symbol || "").split('.')[0],
    fullSymbol: raw.symbol,
    pricePaise: enforcePaise(toPaise(raw.regularMarketPrice), "pricePaise"),
    changePercent: raw.regularMarketChangePercent || raw.changePercent || 0,
    volume: raw.regularMarketVolume || raw.volume || 0,
    marketCap: raw.marketCap || null,
    peRatio: raw.trailingPE || raw.peRatio || null,
    lastUpdate: raw.regularMarketTime || new Date(),
    source: "REAL",
    isSynthetic: false,
    isFallback: false,
  };
};

/**
 * 2. DATA INTEGRITY VALIDATION
 */
const validateQuote = (quote) => {
  if (!quote || !quote.symbol) return false;
  // Reject non-integers (Floating point leakage detected)
  if (!Number.isInteger(quote.pricePaise)) return false;
  // Reject absurdly low prices
  if (quote.pricePaise <= 100) return false;
  if (!quote.lastUpdate) return false;
  return true;
};

const getStockSnapshot = async (symbol) => {
  const apiSymbol = normalizeSymbol(symbol);

  // 1. Check Cache
  const cached = cache.get(apiSymbol);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    await respectRateLimit();
    const raw = await yahooFinance.quote(apiSymbol);
    const quote = normalizeQuote(raw);

    if (!validateQuote(quote)) {
      throw new Error(`CRITICAL_DATA_INTEGRITY_VIOLATION: ${apiSymbol}`);
    }

    // Deterministic Trend Logic
    quote.trend = quote.changePercent > 1 ? "BULLISH" : quote.changePercent < -1 ? "BEARISH" : "SIDEWAYS";

    // Store in cache
    cache.set(apiSymbol, { data: quote, timestamp: Date.now() });

    return quote;
  } catch (error) {
    console.error(`[HardenedPipeline] Fetch error for ${apiSymbol}:`, error.message);
    throw new AppError("MARKET_DATA_UNAVAILABLE", 503);
  }
};

const resolvePrice = async (symbol) => {
  const apiSymbol = normalizeSymbol(symbol);
  const cached = cache.get(apiSymbol);
  const hasCachedQuote = Boolean(
    cached?.data &&
    Number.isInteger(cached.data.pricePaise) &&
    cached.data.pricePaise > 100
  );
  if (hasCachedQuote && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return {
      pricePaise: cached.data.pricePaise,
      source: "CACHE",
      isFallback: Boolean(cached.data.isFallback),
      isStale: false,
    };
  }

  try {
    const quote = await getStockSnapshot(symbol);
    return {
      pricePaise: quote.pricePaise,
      source: quote.isFallback ? "FALLBACK" : "REAL",
      isFallback: Boolean(quote.isFallback),
      isStale: false,
    };
  } catch (error) {
    // Strict fallback chain: CACHE -> STALE -> REJECT
    if (hasCachedQuote) {
      return {
        pricePaise: cached.data.pricePaise,
        source: "STALE",
        isFallback: true,
        isStale: true,
      };
    }

    if (error instanceof AppError) throw error;
    throw new AppError("MARKET_DATA_UNAVAILABLE", 503);
  }
};

const resolvePrices = async (symbols = []) => {
  if (!symbols.length) return {};
  const pairs = await Promise.all(symbols.map(async (symbol) => {
    const resolved = await resolvePrice(symbol);
    const normalized = normalizeSymbol(symbol);
    return [normalized, resolved];
  }));

  const map = {};
  pairs.forEach(([normalized, resolved]) => {
    const base = (normalized || "").split(".")[0];
    if (base) map[base] = resolved;
    if (normalized) map[normalized] = resolved;
  });
  return map;
};

/**
 * 4. BATCH FETCHING (O(1) per batch)
 */
const getBulkSnapshots = async (symbols = []) => {
  if (!symbols.length) return [];

  // Chunking to prevent URI too long or rate limits (25 per batch)
  const CHUNK_SIZE = SYSTEM_CONFIG.marketData.batchChunkSize;
  const chunks = [];
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    chunks.push(symbols.slice(i, i + CHUNK_SIZE));
  }

  // Fetch all chunks in parallel for maximum speed
  const chunkPromises = chunks.map(async (chunk) => {
    const apiSymbols = chunk.map(s => normalizeSymbol(s));
    try {
      const rawQuotes = await yahooFinance.quote(apiSymbols);
      const quotesArray = Array.isArray(rawQuotes) ? rawQuotes : [rawQuotes];
      
      return quotesArray
        .filter(q => q)
        .map(q => {
          const normalized = normalizeQuote(q);
          if (validateQuote(normalized)) {
            normalized.trend = normalized.changePercent > 1 ? "BULLISH" : normalized.changePercent < -1 ? "BEARISH" : "SIDEWAYS";
            return normalized;
          }
          return null;
        })
        .filter(q => q);
    } catch (error) {
      if (String(error?.message || "").includes("MISSING_REQUIRED_FIELD:regularMarketPrice")) {
        throw error;
      }
      console.error(`[DataPipeline] Chunk fetch failed for ${apiSymbols.join(',')}:`, error.message);
      // Fallback for individual symbols in this chunk
      const individualResults = await Promise.all(chunk.map(async (s) => {
        try {
          const single = await getStockSnapshot(s);
          return single;
        } catch (e) {
          if (String(e?.message || "").includes("MISSING_REQUIRED_FIELD:regularMarketPrice")) {
            throw e;
          }
          return null;
        }
      }));
      return individualResults.filter(r => r);
    }
  });

  const allResults = await Promise.all(chunkPromises);
  return allResults.flat();
};

/**
 * FETCH EXPLORE DATA (NIFTY 500 SCALING)
 */
const getExploreData = async (limit = 20, offset = 0, search = "") => {
const { NIFTY_500 } = require('../constants/nifty500');

const MASTER_POOL = NIFTY_500;

  let symbols = MASTER_POOL;

  if (search) {
    const q = search.toUpperCase();
    symbols = MASTER_POOL.filter(s => s.includes(q));
  }

  const paginated = symbols.slice(offset, offset + limit);
  console.log(`[MarketExplorer] Bulk Loading ${paginated.length} symbols at offset ${offset}`);

  const final = await getBulkSnapshots(paginated);

  // GUARANTEE NON-EMPTY STATE EVEN IN OFFLINE/PROVIDER FAILURES
  if (final.length === 0) {
    if (!search && offset === 0) {
      console.warn("[MarketExplorer] Live provider unavailable, serving deterministic synthetic universe.");
    }
    const stocks = paginated.map((s, idx) => buildSyntheticQuote(normalizeSymbol(s), idx));
    return {
      stocks,
      meta: {
        isSynthetic: true,
        isFallback: true,
      },
    };
  }

  return {
    stocks: final,
    meta: {
      isSynthetic: final.some((item) => item.isSynthetic === true),
      isFallback: final.some((item) => item.isFallback === true),
    },
  };
};

/**
 * GET LIVE QUOTE (Detailed)
 */
const getLivePrice = async (symbol) => {
  return await resolvePrice(symbol);
};

/**
 * GET HISTORICAL DATA
 */
const getHistorical = async (symbol, period = "1mo") => {
  const apiSymbol = normalizeSymbol(symbol);
  try {
    const periodMap = {
      '1d': 1,
      '5d': 5,
      '1mo': 30,
      '3mo': 90,
      '6mo': 180,
      '1y': 365
    };

    const days = periodMap[period] || 30;
    const period1 = new Date();
    period1.setDate(period1.getDate() - days);

    // Using .chart() as .historical() is deprecated and restricted
    const result = await yahooFinance.chart(apiSymbol, {
      period1: period1,
      period2: new Date(),
      interval: '1d'
    });

    if (!result || !result.quotes) {
      return { success: true, data: { prices: [], source: "Yahoo (Empty)" } };
    }

    // Filter, Normalize, and Sort OHLC
    const prices = result.quotes
      .filter(q => q.open && q.high && q.low && q.close && q.date)
      .map(q => ({
        date: q.date instanceof Date ? q.date.toISOString().split('T')[0] : q.date,
        timestamp: q.date instanceof Date ? q.date.getTime() : new Date(q.date).getTime(),
        openPaise: toPaise(q.open),
        highPaise: toPaise(q.high),
        lowPaise: toPaise(q.low),
        closePaise: toPaise(q.close),
        volume: q.volume || 0
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      prices,
      source: "Yahoo Chart API",
      isSynthetic: false,
      isFallback: false,
    };
  } catch (error) {
    console.error(`[DataPipeline] History fail for ${apiSymbol}:`, error.message);
    // Graceful Degradation: Return empty state instead of crashing
    return {
      prices: [],
      source: "Fallback Cache",
      isSynthetic: false,
      isFallback: true,
    };
  }
};

/**
 * GET FUNDAMENTALS
 */
const getFundamentals = async (symbol) => {
  const apiSymbol = normalizeSymbol(symbol);
  try {
    const result = await yahooFinance.quoteSummary(apiSymbol, { modules: ["summaryDetail", "defaultKeyStatistics"] });
    return result;
  } catch (error) {
    return null;
  }
};

/**
 * VALIDATE SYMBOL
 */
const validateSymbol = async (symbol) => {
  if (!symbol) return { isValid: false };
  try {
    const quote = await resolvePrice(symbol);
    const isValid = typeof quote?.pricePaise === "number" && quote.pricePaise > 100;
    return {
      isValid,
      symbol: normalizeSymbol(symbol)?.split(".")[0],
      data: isValid ? quote : null,
      source: quote?.source || "FALLBACK",
      isSynthetic: false,
      isFallback: Boolean(quote?.isFallback),
    };
  } catch {
    return { isValid: false };
  }
};

/**
 * GET MARKET INDICES
 */
const getMarketIndices = async () => {
  const indices = ['^NSEI', '^BSESN', '^NSEBANK'];
  try {
    const quotes = await yahooFinance.quote(indices);
    return quotes.map(q => ({
      symbol: q.symbol === '^NSEI' ? 'NIFTY 50' : q.symbol === '^BSESN' ? 'SENSEX' : 'BANK NIFTY',
      pricePaise: toPaise(q.regularMarketPrice),
      changePaise: toPaise(q.regularMarketChange),
      changePercent: q.regularMarketChangePercent,
      currency: 'INR',
      source: "REAL",
      isSynthetic: false,
      isFallback: false,
    }));
  } catch (error) {
    console.error("[MarketDataService] Indices fail:", error.message);
    return [];
  }
};

/**
 * GET LIVE PRICES (Bulk)
 */
const getLivePrices = async (symbols = []) => {
  return await resolvePrices(symbols);
};

module.exports = {
  resolvePrice,
  resolvePrices,
  getStockSnapshot,
  getExploreData,
  getLivePrice,
  getLivePrices,
  getHistorical,
  getFundamentals,
  validateSymbol,
  getMarketIndices
};
