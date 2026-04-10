const { getLivePrice, getLivePricesBatch } = require('./live.provider');
const historicalProvider = require('./historical.provider');
const newsProvider = require('./news.provider');
const Stock = require('../../models/stock.model');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const { NIFTY_500 } = require("../../constants/nifty500");

/**
 * MARKET DATA SERVICE
 * Centralized entry point for all market intelligence requests.
 */

const getLivePriceLocal = async (symbol) => {
  return await getLivePrice(symbol);
};

const validateSymbol = async (symbol) => {
  try {
    const data = await getLivePriceLocal(symbol);
    return { isValid: !!data && !!data.price, data };
  } catch (err) {
    return { isValid: false };
  }
};

const getHistorical = async (symbol, period) => {
  return await historicalProvider.getHistory(symbol, period);
};

const getNews = async (symbol) => {
  return await newsProvider.getNews(symbol);
};

/**
 * FUNDAMENTALS
 * Fetch from DB or update from Yahoo if stale (> 24h)
 */
const getFundamentals = async (symbol) => {
  const normSymbol = (symbol.startsWith('^') || symbol.includes('.') || symbol.endsWith('=F') || symbol.endsWith('=X')) 
    ? symbol.toUpperCase() 
    : `${symbol.toUpperCase()}.NS`;
  
  // 1. Check DB
  let stock = await Stock.findOne({ symbol: normSymbol });
  
  const IS_STALE = !stock || (Date.now() - stock.lastFundamentalUpdate.getTime()) > (24 * 60 * 60 * 1000);

  if (IS_STALE) {
    console.log(`[MarketDataService] Updating fundamentals for ${normSymbol}`);
    try {
      const quote = await yahooFinance.quote(normSymbol);
      
      const updateData = {
        symbol: normSymbol,
        name: quote.longName || quote.shortName,
        sector: quote.sector || "Unclassified",
        marketCap: quote.marketCap,
        peRatio: quote.trailingPE || quote.forwardPE,
        volume: quote.regularMarketVolume,
        lastFundamentalUpdate: new Date()
      };

      stock = await Stock.findOneAndUpdate(
        { symbol: normSymbol },
        { $set: updateData },
        { upsert: true, new: true }
      );
    } catch (error) {
      if (!stock) throw new Error(`FUNDAMENTAL_DATA_UNAVAILABLE: ${normSymbol}`);
      console.warn(`[MarketDataService] Yahoo fail for ${normSymbol}, using stale DB data.`);
    }
  }

  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    marketCap: stock.marketCap,
    peRatio: stock.peRatio,
    volume: stock.volume,
    source: 'DB'
  };
};

const getExploreData = async (limit = 16, offset = 0, query = "") => {
  let fullUniverse = NIFTY_500;

  if (query) {
    const normQuery = query.toLowerCase().replace(/\s+/g, '');
    fullUniverse = fullUniverse.filter(s => 
      s.toLowerCase().replace(/\s+/g, '').includes(normQuery)
    );
  }

  const watchList = fullUniverse.slice(offset, offset + limit);

  // 1. Batch Fetch Live Prices for the page
  const livePrices = await getLivePricesBatch(watchList);
  
  const results = await Promise.all(
    watchList.map(async (s) => {
      try {
        const normSymbol = (s.startsWith('^') || s.includes('.') || s.endsWith('=F') || s.endsWith('=X')) 
          ? s.toUpperCase() 
          : `${s.toUpperCase()}.NS`;
        
        const priceObj = livePrices[normSymbol];
        const price = priceObj?.price || 0;
        const fundamentals = await getFundamentals(s);
        
        return {
          symbol: s,
          price: price,
          changePercent: priceObj?.changePercent || 0,
          sector: fundamentals?.sector || "Discovery",
          marketCap: fundamentals?.marketCap || 0,
          peRatio: fundamentals?.peRatio || 0,
          volume: fundamentals?.volume || 0,
          trend: "SIDEWAYS"
        };
      } catch (err) {
        // Return a baseline partial object to keep the UI shell alive
        return {
          symbol: s,
          price: 0,
          changePercent: 0,
          sector: "Processing...",
          marketCap: 0,
          peRatio: 0,
          trend: "SIDEWAYS"
        };
      }
    })
  );
  return results; // No filter, keep all cards
};

const getLivePricesForSummary = async (symbols) => {
  if (!symbols || !symbols.length) return {};
  const results = await getLivePricesBatch(symbols);
  
  // Map batch objects to flat price numbers for calculation compatibility
  const priceMap = {};
  Object.entries(results).forEach(([sym, data]) => {
    priceMap[sym] = data.price;
    const bare = sym.split('.')[0];
    priceMap[bare] = data.price;
  });
  return priceMap;
};

const getMarketIndices = async () => {
  const symbols = [
    { key: 'NIFTY 50', symbol: '^NSEI' },
    { key: 'SENSEX', symbol: '^BSESN' },
    { key: 'NASDAQ 100', symbol: '^IXIC' },
    { key: 'S&P 500', symbol: '^GSPC' },
    { key: 'GOLD', symbol: 'GC=F' },
    { key: 'SILVER', symbol: 'SI=F' },
    { key: 'USD/INR', symbol: 'USDINR=X' }
  ];

  const results = await Promise.all(
    symbols.map(async (item) => {
      try {
        const live = await getLivePriceLocal(item.symbol);
        return {
          key: item.key,
          symbol: item.symbol,
          price: live.price,
          change: live.changePercent,
          currency: item.symbol.includes('^NSE') ? 'INR' : 'USD'
        };
      } catch (err) {
        return { key: item.key, symbol: item.symbol, price: null, change: 0, currency: 'N/A' };
      }
    })
  );
  return results;
};

const getGlobalNews = async () => {
  // Use the newsProvider waterfall for macro queries
  return await newsProvider.getNews('Stock Market India');
};

module.exports = {
  getLivePrice,
  getLivePrices: getLivePricesForSummary,
  getHistorical,
  getNews,
  getFundamentals,
  getExploreData,
  validateSymbol,
  getMarketIndices,
  getGlobalNews
};
