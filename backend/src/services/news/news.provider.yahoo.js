const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/**
 * YAHOO NEWS PROVIDER (FALLBACK)
 */
const getNews = async (symbol) => {
  const sym = symbol.toUpperCase();
  // Smart Normalization: 
  // 1. Already has a suffix? Leave it.
  // 2. Contains '=' (Commodities/Indices)? Leave it.
  // 3. Known Indian formats? (e.g. RELIANCE, NIFTY) -> Append .NS
  // Rule: Institutional Symbol Normalization
  let normalizedSymbol = sym;
  const isGlobal = ["AAPL", "MSFT", "TSLA", "GOOGL", "AMZN", "META", "NVDA"].includes(sym);
  const isCommodity = sym.includes("=");
  const isIndex = sym.startsWith("^");

  if (!isGlobal && !isCommodity && !isIndex && !sym.includes(".")) {
    normalizedSymbol = `${sym}.NS`;
  }
  try {
    const results = await yahooFinance.search(normalizedSymbol, { newsCount: 10 });
    
    if (!results || !results.news) return [];

    return results.news.map(item => ({
      headline: item.title,
      source: item.publisher,
      timestamp: new Date(item.providerPublishTime).getTime() || Date.now(),
      url: item.link,
      summary: "" // Yahoo search news often lacks full summary in search result
    }));
  } catch (error) {
    console.warn(`[NewsProvider:Yahoo] Failed for ${symbol}: ${error.message}`);
    throw error;
  }
};

module.exports = { getNews };
