const axios = require('axios');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const { toYahooSymbol } = require("../../utils/symbol.utils");
const logger = require("../../utils/logger");

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
  const normSymbol = toYahooSymbol(symbol);
  
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
    logger.warn({
      event: "HISTORICAL_PROVIDER_PYTHON_FALLBACK",
      symbol: normSymbol,
      message: error.message,
    });
    
    // 3. Native Fallback (Yahoo Finance Node)
    try {
      const now = new Date();
      let period1;
      let intervalRequest = interval;
      
      // Calculate start date with buffer for indicators (EMA20/RSI14 needs ~20-30 data points)
      switch(period) {
        case '1d': 
          period1 = new Date(now.getTime() - 3 * 86400000); // 3 days
          intervalRequest = '1h'; 
          break;
        case '1wk': 
          period1 = new Date(now.getTime() - 21 * 86400000); 
          intervalRequest = '1h';
          break;
        case '1mo': 
          period1 = new Date(now.getTime() - 60 * 86400000); 
          intervalRequest = '1d';
          break;
        case '3mo': 
          period1 = new Date(now.getTime() - 150 * 86400000); 
          intervalRequest = '1d';
          break;
        case '1y': 
          period1 = new Date(now.getTime() - 450 * 86400000); 
          intervalRequest = '1wk';
          break;
        default: 
          period1 = new Date(now.getTime() - 60 * 86400000);
      }

      const result = await yahooFinance.chart(normSymbol, {
        period1,
        period2: now,
        interval: intervalRequest
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
      logger.error({
        event: "HISTORICAL_PROVIDER_ALL_FAILED",
        symbol: normSymbol,
        message: fallbackErr.message,
      });
      throw new Error(`HISTORICAL_DATA_UNAVAILABLE: ${normSymbol}`);
    }
  }
};

module.exports = { getHistory };
