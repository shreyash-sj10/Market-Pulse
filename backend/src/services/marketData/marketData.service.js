const liveProvider = require('./live.provider');
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

const getLivePrice = async (symbol) => {
  return await liveProvider.getLivePrice(symbol);
};

const validateSymbol = async (symbol) => {
  try {
    const data = await getLivePrice(symbol);
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
  const normSymbol = (symbol.startsWith('^') || symbol.includes('.')) 
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

  const results = await Promise.all(
    watchList.map(async (s) => {
      try {
        const live = await getLivePrice(s);
        const fundamentals = await getFundamentals(s);
        return {
          symbol: s,
          price: live?.price || 0,
          changePercent: live?.changePercent || 0,
          sector: fundamentals?.sector || "Discovery",
          marketCap: fundamentals?.marketCap || 0,
          peRatio: fundamentals?.peRatio || 0,
          trend: live?.changePercent > 1 ? "BULLISH" : live?.changePercent < -1 ? "BEARISH" : "SIDEWAYS"
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

const getLivePrices = async (symbols) => {
  if (!symbols || !symbols.length) return {};
  const results = await Promise.all(
    symbols.map(async (s) => {
      try {
        const data = await liveProvider.getLivePrice(s);
        return { symbol: s, price: data.price };
      } catch (err) {
        return null;
      }
    })
  );
  
  const priceMap = {};
  results.forEach(r => {
    if (r) {
      priceMap[r.symbol] = r.price;
      const bare = r.symbol.split('.')[0];
      priceMap[bare] = r.price;
      priceMap[`${bare}.NS`] = r.price;
    }
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
        const live = await liveProvider.getLivePrice(item.symbol);
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
  getLivePrices,
  getHistorical,
  getNews,
  getFundamentals,
  getExploreData,
  validateSymbol,
  getMarketIndices,
  getGlobalNews
};
