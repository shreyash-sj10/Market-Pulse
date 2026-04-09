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
const getLivePrice = async (symbol) => {
  const normalizedSymbol = (symbol.startsWith('^') || symbol.includes('.')) 
    ? symbol.toUpperCase() 
    : `${symbol.toUpperCase()}.NS`;
  
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
      price: validPrice,
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
      const cleanSymbol = symbol.split('.')[0]; // Finnhub often uses naked tickers
      const res = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${cleanSymbol}&token=${finnhubKey}`);
      
      if (!res.data.c) throw new Error('NO_DATA_FROM_FALLBACK');

      const data = {
        symbol: normalizedSymbol,
        price: res.data.c,
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

module.exports = { getLivePrice };
