const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/**
 * YAHOO NEWS PROVIDER (FALLBACK)
 */
const getNews = async (symbol) => {
  const normalizedSymbol = symbol.toUpperCase().endsWith('.NS') ? symbol.toUpperCase() : `${symbol.toUpperCase()}.NS`;

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
