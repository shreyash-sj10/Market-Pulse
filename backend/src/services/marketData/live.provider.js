const axios = require('axios');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const { getQuoteCache, setQuoteCache } = require("../../utils/marketQuoteCache");
const { toYahooSymbol } = require("../../utils/symbol.utils");
const logger = require("../../utils/logger");

const finnhubApiKey = () =>
  process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY;

/** Indian equities on Finnhub use NSE:SYMBOL (INR). */
const toFinnhubSymbol = (symbol) => {
  const s = String(symbol || "").toUpperCase().trim();
  const base = s.split(".")[0];
  if (!base || base.startsWith("^") || base.includes("=F") || base.includes("=X")) return base;
  return `NSE:${base}`;
};

const resolvePrice = async (symbol) => {
  const normalizedSymbol = toYahooSymbol(symbol);

  const cached = await getQuoteCache(normalizedSymbol);
  if (cached?.tier === "HOT") {
    return { ...cached.data, source: "CACHE" };
  }

  // 2. Try Primary (Yahoo)
  try {
    const quote = await yahooFinance.quote(normalizedSymbol);
    const validPrice = quote.regularMarketPrice || quote.ask || quote.bid || quote.previousClose || 0;
    
    if (validPrice === 0) throw new Error('YAHOO_PRICE_ZERO');

    const data = {
      symbol: quote.symbol,
      pricePaise: Math.round(validPrice * 100), // INR paise
      changePercent: Number((quote.regularMarketChangePercent || 0).toFixed(2)),
      source: 'REAL',
      isFallback: false
    };
    await setQuoteCache(normalizedSymbol, data);
    return data;
  } catch (primaryError) {
    logger.warn({
      event: "LIVE_PROVIDER_YAHOO_FALLBACK",
      symbol: normalizedSymbol,
      message: primaryError?.message,
    });
    
    // 3. Try Fallback (Finnhub)
    try {
      const key = finnhubApiKey();
      if (!key) throw new Error("FINNHUB_API_KEY_MISSING");
      const fhSym = toFinnhubSymbol(symbol);
      const res = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(fhSym)}&token=${key}`);
      
      if (!res.data.c) throw new Error('NO_DATA_FROM_FALLBACK');

      const data = {
        symbol: normalizedSymbol,
        pricePaise: Math.round(res.data.c * 100), // Finnhub NSE quote is INR; store paise
        changePercent: Number((res.data.dp || 0).toFixed(2)),
        source: 'FALLBACK',
        isFallback: true
      };
      
      await setQuoteCache(normalizedSymbol, data);
      return data;
    } catch (fallbackError) {
      logger.error({
        event: "LIVE_PROVIDER_ALL_FAILED",
        symbol: normalizedSymbol,
        message: fallbackError?.message,
      });
      throw new Error(`MARKET_DATA_UNAVAILABLE: ${normalizedSymbol}`);
    }
  }
};

/**
 * BATCH LIVE PROVIDER
 * Uses yahooFinance.quote(Array) to fetch multiple quotes in a single request.
 */
const getLivePricesBatch = async (symbols) => {
  if (!symbols || !symbols.length) return {};
  
  const normalizedSymbols = symbols.map(toYahooSymbol);

  // 1. Separate cached from needed
  const results = {};
  const needed = [];

  for (const s of normalizedSymbols) {
    /* eslint-disable no-await-in-loop */
    const cached = await getQuoteCache(s);
    if (cached?.tier === "HOT") {
      results[s] = cached.data;
    } else {
      needed.push(s);
    }
  }

  if (needed.length === 0) return results;

  // 2. Fetch missing in one call
  try {
    const quotes = await yahooFinance.quote(needed);
    const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

    quotesArray.forEach(quote => {
      const symKey = toYahooSymbol(quote.symbol || "");
      const validPrice = quote.regularMarketPrice || quote.ask || quote.bid || quote.previousClose || 0;
      const pricePaise = Math.round(validPrice * 100);
      
      const data = {
        symbol: symKey,
        pricePaise,
        changePercent: Number((quote.regularMarketChangePercent || 0).toFixed(2)),
        source: 'REAL',
        isFallback: false
      };
      
      void setQuoteCache(symKey, data);
      results[symKey] = data;
    });
  } catch (err) {
    logger.error({
      event: "LIVE_PROVIDER_BATCH_FAILED",
      message: err.message,
    });
    // Fallback one by one if batch fails (safest)
    for (const s of needed) {
      try {
        const data = await resolvePrice(s);
        results[s] = data;
      } catch (e) {}
    }
  }

  return results;
};

const getLivePrice = resolvePrice;

module.exports = { resolvePrice, getLivePrice, getLivePricesBatch };
