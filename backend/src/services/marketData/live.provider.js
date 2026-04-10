const axios = require('axios');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Caching layer
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

/**
 * LIVE PROVIDER
 * Primary: Yahoo Finance (supports Indian stocks natively with .NS)
 * Fallback: Finnhub
 */
/**
 * SYMBOL NORMALIZER
 * Logic: 
 * - If index (^), future (=F), or currency (=X), use as-is (uppercase).
 * - If already has dot (.), assume it has exchange suffix (uppercase).
 * - Otherwise, default to National Stock Exchange (.NS).
 */
const toYahooSymbol = (symbol) => {
  const s = symbol.toUpperCase().trim();
  if (s.startsWith('^') || s.includes('.') || s.endsWith('=F') || s.endsWith('=X')) {
    return s;
  }
  return `${s}.NS`;
};

const getLivePrice = async (symbol) => {
  const normalizedSymbol = toYahooSymbol(symbol);
  
  // 1. Check Cache
  const cached = cache.get(normalizedSymbol);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return { ...cached.data, source: 'CACHE' };
  }

  // 2. Try Primary (Yahoo)
  try {
    const quote = await yahooFinance.quote(normalizedSymbol);
    const validPrice = quote.regularMarketPrice || quote.ask || quote.bid || quote.previousClose || 0;
    
    if (validPrice === 0) throw new Error('YAHOO_PRICE_ZERO');

    const data = {
      symbol: quote.symbol,
      price: Math.round(validPrice * 100), // Store as Paise
      changePercent: Number((quote.regularMarketChangePercent || 0).toFixed(2)),
      source: 'PRIMARY_YAHOO'
    };
    cache.set(normalizedSymbol, { data, timestamp: Date.now() });
    return data;
  } catch (primaryError) {
    console.warn(`[LiveProvider] Primary fail for ${normalizedSymbol}, trying fallback.`);
    
    // 3. Try Fallback (Finnhub)
    try {
      const finnhubKey = process.env.VITE_FINNHUB_API_KEY;
      const cleanSymbol = symbol.split('.')[0]; 
      const res = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${cleanSymbol}&token=${finnhubKey}`);
      
      if (!res.data.c) throw new Error('NO_DATA_FROM_FALLBACK');

      const data = {
        symbol: normalizedSymbol,
        price: Math.round(res.data.c * 100), // Store as Paise
        changePercent: Number((res.data.dp || 0).toFixed(2)),
        source: 'FALLBACK_FINNHUB'
      };
      
      cache.set(normalizedSymbol, { data, timestamp: Date.now() });
      return data;
    } catch (fallbackError) {
      console.error(`[LiveProvider] CRITICAL: All providers failed for ${normalizedSymbol}`);
      throw new Error(`MARKET_DATA_UNAVAILABLE: ${normalizedSymbol}`);
    }
  }
};

/**
 * BATCH LIVE PROVIDER
 * Uses yahooFinance.quote(Array) to fetch multiple prices in a single request.
 */
const getLivePricesBatch = async (symbols) => {
  if (!symbols || !symbols.length) return {};
  
  const normalizedSymbols = symbols.map(toYahooSymbol);

  // 1. Separate cached from needed
  const results = {};
  const needed = [];

  normalizedSymbols.forEach(s => {
    const cached = cache.get(s);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      results[s] = cached.data;
    } else {
      needed.push(s);
    }
  });

  if (needed.length === 0) return results;

  // 2. Fetch missing in one call
  try {
    const quotes = await yahooFinance.quote(needed);
    const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

    quotesArray.forEach(quote => {
      const sym = (quote.symbol || "").toUpperCase();
      const validPrice = quote.regularMarketPrice || quote.ask || quote.bid || quote.previousClose || 0;
      const pricePaise = Math.round(validPrice * 100);
      
      const data = {
        symbol: sym,
        price: pricePaise,
        changePercent: Number((quote.regularMarketChangePercent || 0).toFixed(2)),
        source: 'BATCH_YAHOO'
      };
      
      cache.set(sym, { data, timestamp: Date.now() });
      results[sym] = data;
    });
  } catch (err) {
    console.error(`[LiveProvider] Batch fetch failed:`, err.message);
    // Fallback one by one if batch fails (safest)
    for (const s of needed) {
      try {
        const data = await getLivePrice(s);
        results[s] = data;
      } catch (e) {}
    }
  }

  return results;
};

module.exports = { getLivePrice, getLivePricesBatch };
