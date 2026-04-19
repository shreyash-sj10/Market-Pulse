const axios = require('axios');

/**
 * FINNHUB NEWS PROVIDER (PRIMARY)
 */
const getNews = async (symbol) => {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error("FINNHUB_API_KEY_MISSING");

  const cleanSymbol = symbol.split('.')[0];
  const finnhubSymbol = cleanSymbol.startsWith("^") ? cleanSymbol : `NSE:${cleanSymbol}`;
  
  // Date range for news (last 7 days)
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const response = await axios.get(`https://finnhub.io/api/v1/company-news`, {
      params: {
        symbol: finnhubSymbol,
        from,
        to,
        token: apiKey
      }
    });

    if (!Array.isArray(response.data)) return [];

    return response.data.map(item => ({
      headline: item.headline,
      source: item.source,
      timestamp: item.datetime * 1000, // Finnhub is in seconds
      url: item.url,
      summary: item.summary
    }));
  } catch (error) {
    require("../../utils/logger").warn({ event: "NEWS_PROVIDER_FINNHUB_FAIL", symbol, message: error.message });
    throw error;
  }
};

module.exports = { getNews };
