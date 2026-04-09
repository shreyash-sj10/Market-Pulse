const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const AppError = require('../utils/AppError');

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Normalizes symbol for Yahoo Finance
 */
const normalizeSymbol = (symbol) => {
  if (!symbol) return symbol;
  const s = symbol.toUpperCase();
  if (s.endsWith('.NS') || s.endsWith('.BO')) return s;
  return `${s}.NS`;
};

/**
 * GET DETAILED SNAPSHOT FOR MARKET EXPLORER
 * Implements deterministic mapping and strict field removal.
 */
const getStockSnapshot = async (symbol) => {
  const apiSymbol = normalizeSymbol(symbol);
  
  // 1. Check Cache
  const cached = cache.get(apiSymbol);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    const quote = await yahooFinance.quote(apiSymbol);
    
    // Deterministic Trend Logic
    const cp = quote.regularMarketChangePercent || 0;
    const trend = cp > 1 ? "BULLISH" : cp < -1 ? "BEARISH" : "SIDEWAYS";

    // RSI Placeholder (Requires historical data for actual calculation, but we'll normalize)
    // For now, we omit if we can't derive it quickly to stay within "No Fake Data" rule.
    
    // Construct Snapshot (Strict Exclusion of missing fields)
    const snapshot = {
      symbol: quote.symbol.split('.')[0],
      price: quote.regularMarketPrice,
      changePercent: Number(cp.toFixed(2)),
      volume: quote.regularMarketVolume,
      trend
    };

    // Optional Fields (Strict Removal)
    if (quote.marketCap) snapshot.marketCap = quote.marketCap;
    if (quote.trailingPE) snapshot.peRatio = Number(quote.trailingPE.toFixed(2));
    
    // Store in cache
    cache.set(apiSymbol, { data: snapshot, timestamp: Date.now() });

    return snapshot;
  } catch (error) {
    console.error(`[MarketDataService] Snapshot fail for ${apiSymbol}:`, error.message);
    return null;
  }
};

/**
 * FETCH EXPLORE DATA
 * Returns a deterministic set of stocks for the explore view.
 */
const getExploreData = async () => {
  const watchList = [
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 
    'ADANIENT', 'SBIN', 'BHARTIARTL', 'LICI', 'ITC',
    'HINDUNILVR', 'LT', 'BAJFINANCE', 'ADANIGREEN', 'TATAMOTORS'
  ];

  const results = await Promise.all(watchList.map(s => getStockSnapshot(s)));
  return results.filter(r => r !== null);
};

module.exports = {
  getStockSnapshot,
  getExploreData
};
