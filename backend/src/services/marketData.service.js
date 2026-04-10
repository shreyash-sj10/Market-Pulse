const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const AppError = require('../utils/AppError');

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

const FALLBACK_STOCKS = {
  'RELIANCE': { symbol: 'RELIANCE', price: 295045, changePercent: 1.2, volume: 5400000, trend: 'BULLISH', marketCap: 19500000000000, peRatio: 28.4 },
  'TCS': { symbol: 'TCS', price: 384010, changePercent: -0.4, volume: 2100000, trend: 'SIDEWAYS', marketCap: 14200000000000, peRatio: 30.1 },
  'HDFCBANK': { symbol: 'HDFCBANK', price: 145025, changePercent: 0.8, volume: 18000000, trend: 'BULLISH', marketCap: 11000000000000, peRatio: 18.5 },
  'INFY': { symbol: 'INFY', price: 152080, changePercent: -1.5, volume: 8500000, trend: 'BEARISH', marketCap: 6300000000000, peRatio: 24.2 },
  'ICICIBANK': { symbol: 'ICICIBANK', price: 98050, changePercent: 2.1, volume: 12000000, trend: 'BULLISH', marketCap: 7200000000000, peRatio: 17.8 },
  'ADANIENT': { symbol: 'ADANIENT', price: 312000, changePercent: 4.5, volume: 4200000, trend: 'BULLISH', marketCap: 3500000000000, peRatio: 112.5 },
  'SBIN': { symbol: 'SBIN', price: 74015, changePercent: 0.2, volume: 25000000, trend: 'SIDEWAYS', marketCap: 6600000000000, peRatio: 9.4 },
  'BHARTIARTL': { symbol: 'BHARTIARTL', price: 112040, changePercent: 1.1, volume: 6800000, trend: 'BULLISH', marketCap: 6200000000000, peRatio: 54.3 },
  'ITC': { symbol: 'ITC', price: 41085, changePercent: -0.5, volume: 15000000, trend: 'SIDEWAYS', marketCap: 5200000000000, peRatio: 25.1 },
  'TATAMOTORS': { symbol: 'TATAMOTORS', price: 94060, changePercent: 3.2, volume: 14000000, trend: 'BULLISH', marketCap: 3200000000000, peRatio: 16.2 }
};

const toPaise = (val) => Math.round((val || 0) * 100);

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
  // Only allow INR assets to prevent price distortion (USD vs INR)
  if (raw.currency && raw.currency !== 'INR') {
    console.warn(`[IntegrityWall] Rejecting asset ${raw.symbol} due to currency mismatch: ${raw.currency}`);
    return null;
  }

  // Support both Yahoo and generic formats
  return {
    symbol: (raw.symbol || "").split('.')[0],
    fullSymbol: raw.symbol,
    price: toPaise(raw.regularMarketPrice || raw.price || 0),
    changePercent: raw.regularMarketChangePercent || raw.changePercent || 0,
    volume: raw.regularMarketVolume || raw.volume || 0,
    marketCap: raw.marketCap || null,
    peRatio: raw.trailingPE || raw.peRatio || null,
    lastUpdate: raw.regularMarketTime || new Date()
  };
};

/**
 * 2. DATA INTEGRITY VALIDATION
 */
const validateQuote = (quote) => {
  if (!quote || !quote.symbol) return false;
  // Reject absurdly low prices for Nifty stocks (Paise check: price <= 100 means Rupees <= 1)
  if (typeof quote.price !== 'number' || quote.price <= 100) return false;
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

/**
 * 4. BATCH FETCHING (O(1) per batch)
 */
const getBulkSnapshots = async (symbols = []) => {
  if (!symbols.length) return [];
  
  const apiSymbols = symbols.map(s => normalizeSymbol(s));
  
  try {
    const rawQuotes = await yahooFinance.quote(apiSymbols);
    // Yahoo returns an array of quotes. Normalize each.
    return rawQuotes
      .map(q => {
         const normalized = normalizeQuote(q);
         if (!validateQuote(normalized)) return null;
         normalized.trend = normalized.changePercent > 1 ? "BULLISH" : normalized.changePercent < -1 ? "BEARISH" : "SIDEWAYS";
         return normalized;
      })
      .filter(r => r !== null);
  } catch (error) {
    console.error("[DataPipeline] Bulk fetch failed:", error.message);
    // Individual fallback loop as safety net
    const settlement = await Promise.allSettled(symbols.map(s => getStockSnapshot(s)));
    return settlement
      .map(p => p.status === 'fulfilled' ? p.value : null)
      .filter(r => r !== null);
  }
};

/**
 * FETCH EXPLORE DATA (NIFTY 500 SCALING)
 */
const getExploreData = async (limit = 20, offset = 0, search = "") => {
  const MASTER_POOL = [
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 
    'ADANIENT', 'SBIN', 'BHARTIARTL', 'LICI', 'ITC',
    'HINDUNILVR', 'LT', 'BAJFINANCE', 'ADANIGREEN', 'TATAMOTORS',
    'KOTAKBANK', 'AXISBANK', 'ADANIPORTS', 'ASIANPAINT', 'MARUTI',
    'SUNPHARMA', 'TITAN', 'HCLTECH', 'NESTLEIND', 'ULTRACEMCO',
    'TATASTEEL', 'POWERGRID', 'M&M', 'NTPC', 'BAJAJFINSV',
    'ONGC', 'JSWSTEEL', 'GRASIM', 'COALINDIA', 'HINDALCO',
    'ADANIPOWER', 'TATACONSUM', 'BRITANNIA', 'CIPLA', 'APOLLOHOSP',
    'SBILIFE', 'EICHERMOT', 'DIVISLAB', 'BPCL', 'DRREDDY',
    'TECHM', 'WIPRO', 'INDUSINDBK', 'HDFCLIFE', 'HEROMOTOCO',
    'ADANIENSOL', 'ABB', 'ADANIGAS', 'AWL', 'AMBUJACEM',
    'APOLLOTYRE', 'ASHOKLEY', 'AUBANK', 'AVANTIFEED',
    'BALKRISIND', 'BANDHANBNK', 'BANKBARODA', 'BANKINDIA', 'BEL',
    'BHEL', 'BIOCON', 'BOSCHLTD', 'CANBK', 'CHOLAFIN',
    'COLPAL', 'CONCOR', 'CUMMINSIND', 'DABUR', 'DALBHARAT',
    'DEEPAKNTR', 'DELHIVERY', 'DLF', 'DMART', 'ESCORTS',
    'EXIDEIND', 'FEDERALBNK', 'FORTIS', 'GAIL', 'GLENMARK',
    'GODREJCP', 'GODREJPROP', 'GUJGASLTD', 'HAL', 'HAVELLS',
    'HDFCAMC', 'HINDCOPPER', 'HINDPETRO', 'HINDZINC', 'IDFCFIRSTB',
    'INDIAMART', 'INDIACEM', 'IRCTC', 'IRFC', 'IEX',
    'IGL', 'INDIGO', 'INDUSTOWER', 'IPCALAB', 'JSL',
    'JUBLFOOD', 'KALYANKJIL', 'KEI', 'LAURUSLABS', 'LICHSGFIN',
    'LUPIN', 'MANAPPURAM', 'MAXHEALTH', 'MAZDOCK', 'METROBRAND',
    'MPHASIS', 'MRF', 'MUTHOOTFIN', 'NATIONALUM', 'NAVINFLUOR',
    'OBEROIRLTY', 'OFSS', 'PAGEIND', 'PAYTM', 'PEL',
    'PERSISTENT', 'PETRONET', 'PIDILITIND', 'PIIND', 'PNB',
    'POLYCAB', 'POONAWALLA', 'RECLTD', 'RVNL', 'SAIL',
    'SHREECEM', 'SHRIRAMFIN', 'SIEMENS', 'SRF', 'SUPREMEIND',
    'SYNGENE', 'TATACOMM', 'TATAELXSI', 'TATAPOWER', 'TATASTEEL',
    'TRENT', 'TRIDENT', 'TVSMOTOR', 'UBL', 'UNIONBANK',
    'UNITDSPR', 'VGUARD', 'VOLTAS', 'YESBANK', 'ZEEL', 'ZOMATO'
  ];

  let symbols = MASTER_POOL;
  
  if (search) {
    const q = search.toUpperCase();
    symbols = MASTER_POOL.filter(s => s.includes(q));
  }

  const paginated = symbols.slice(offset, offset + limit);
  console.log(`[MarketExplorer] Bulk Loading ${paginated.length} symbols at offset ${offset}`);
  
  const final = await getBulkSnapshots(paginated);

  // GUARANTEE NON-EMPTY State
  if (final.length === 0 && !search && offset === 0) {
     console.warn("[MarketExplorer] API returned nothing, serving hardware fallback seeds.");
     return Object.values(FALLBACK_STOCKS).slice(0, limit);
  }

  return final;
};

/**
 * GET LIVE PRICE (Detailed)
 */
const getLivePrice = async (symbol) => {
  return await getStockSnapshot(symbol);
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
        open: toPaise(q.open),
        high: toPaise(q.high),
        low: toPaise(q.low),
        close: toPaise(q.close),
        volume: q.volume || 0
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      prices,
      source: "Yahoo Chart API"
    };
  } catch (error) {
    console.error(`[DataPipeline] History fail for ${apiSymbol}:`, error.message);
    // Graceful Degradation: Return empty state instead of crashing
    return {
       prices: [],
       source: "Fallback Cache"
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
    const quote = await getStockSnapshot(symbol);
    const isValid = validateQuote(quote);
    return { 
      isValid, 
      symbol: quote?.symbol,
      data: isValid ? quote : null,
      source: quote?.isOfflineProxy ? "LOCAL_SEED" : "LIVE_NSE"
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
      price: toPaise(q.regularMarketPrice),
      change: toPaise(q.regularMarketChange),
      changePercent: q.regularMarketChangePercent,
      currency: 'INR'
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
  if (!symbols.length) return {};
  const results = await getBulkSnapshots(symbols);
  const map = {};
  results.forEach(r => {
    if (r) {
      map[r.symbol] = r.price;      // Supports base symbol lookups
      map[r.fullSymbol] = r.price;  // Supports full .NS symbol lookups
    }
  });
  return map;
};

module.exports = {
  getStockSnapshot,
  getExploreData,
  getLivePrice,
  getLivePrices,
  getHistorical,
  getFundamentals,
  validateSymbol,
  getMarketIndices
};
