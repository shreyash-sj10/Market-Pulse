const axios = require('axios');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Caching layer (Historical data is less volatile)
const cache = new Map();
const CACHE_TTL = 3600000; // 1 Hour

/**
 * HISTORICAL PROVIDER
 * Primary: Python yfinance service (external sidecar)
 * Fallback: Node yahoo-finance2 chart
 */
const getHistory = async (symbol, period = '1mo', interval = '1d') => {
  const cacheKey = `${symbol}_${period}_${interval}`;
  const normSymbol = (symbol.startsWith('^') || symbol.includes('.')) 
    ? symbol.toUpperCase() 
    : `${symbol.toUpperCase()}.NS`;
  
  // 1. Check Cache
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return { ...cached.data, source: 'CACHE_H' };
  }

  // 2. Call Python Service
  try {
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5005';
    const res = await axios.get(`${pythonServiceUrl}/history`, {
      params: { symbol: normSymbol, period, interval }
    });

    if (!res.data || !res.data.prices) throw new Error('MALFORMED_PYTHON_RESPONSE');

    const data = {
      symbol: normSymbol,
      prices: res.data.prices,
      isSimulated: false,
      source: 'PYTHON_SIDE_CAR'
    };

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.warn(`[HistoricalProvider] Python fail for ${normSymbol}, attempting Node native fallback.`);
    
    // 3. Native Fallback (Yahoo Finance Node)
    try {
      // Map period/interval to Yahoo format
      // Yahoo uses '1mo', '1y' etc. Interval '1d', '1h' etc.
      const result = await yahooFinance.chart(normSymbol, {
        period1: period, // Yahoo-finance2 chart can handle period strings in newer versions or use period1/period2
        interval: interval
      });

      if (!result || !result.quotes) throw new Error('YAHOO_NATIVE_EMPTY');

      const prices = result.quotes.map(q => ({
        date: q.date.toISOString().split('T')[0],
        open: q.open || q.close,
        high: q.high || q.close,
        low: q.low || q.close,
        close: q.close,
        volume: q.volume || 0
      })).filter(p => p.close !== null);

      const data = {
        symbol: normSymbol,
        prices,
        isSimulated: false,
        source: 'YAHOO_NATIVE_CHART'
      };

      cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (fallbackErr) {
      console.error(`[HistoricalProvider] CRITICAL: All historical providers failed for ${normSymbol}`);
      throw new Error(`HISTORICAL_DATA_UNAVAILABLE: ${normSymbol}`);
    }
  }
};

module.exports = { getHistory };
