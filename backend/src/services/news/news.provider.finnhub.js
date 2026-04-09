const axios = require('axios');

/**
 * FINNHUB NEWS PROVIDER (PRIMARY)
 */
const getNews = async (symbol) => {
  const apiKey = process.env.VITE_FINNHUB_API_KEY;
  if (!apiKey) throw new Error("FINNHUB_API_KEY_MISSING");

  // Finnhub uses naked tickers for global news but NSE:SYMBOL for Indian-specific
  // We'll try both or just normalized.
  const cleanSymbol = symbol.split('.')[0];
  
  // Date range for news (last 7 days)
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const response = await axios.get(`https://finnhub.io/api/v1/company-news`, {
      params: {
        symbol: cleanSymbol,
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
    console.warn(`[NewsProvider:Finnhub] Failed for ${symbol}: ${error.message}`);
    throw error;
  }
};

module.exports = { getNews };
