const axios = require('axios');
const logger = require("../../utils/logger");

/**
 * NEWS PROVIDER
 * Source: Finnhub
 * Implements deterministic rule-based sentiment classification.
 */
const getNews = async (symbol) => {
  const normalizedSymbol = symbol.split('.')[0];
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const finnhubSymbol = normalizedSymbol.startsWith("^") ? normalizedSymbol : `NSE:${normalizedSymbol}`;

  try {
    // Current date and 7 days back
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const res = await axios.get(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(finnhubSymbol)}&from=${from}&to=${to}&token=${finnhubKey}`);
    
    const rawNews = res.data || [];
    
    // Process and Classify Sentiment
    const newsItems = rawNews.slice(0, 10).map(item => {
      const sentiment = classifySentiment(item.headline + " " + item.summary);
      return {
        id: item.id,
        headline: item.headline,
        summary: item.summary,
        url: item.url,
        time: item.datetime,
        sentiment
      };
    });

    // Compute Overall Sentiment
    const sentimentCounts = newsItems.reduce((acc, item) => {
      acc[item.sentiment]++;
      return acc;
    }, { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 });

    const total = newsItems.length;
    let overallSentiment = 'NEUTRAL';
    if (sentimentCounts.BULLISH > total / 2) overallSentiment = 'POSITIVE';
    if (sentimentCounts.BEARISH > total / 2) overallSentiment = 'NEGATIVE';

    return {
      symbol,
      overallSentiment,
      headlines: newsItems,
      source: 'FINNHUB_NEWS'
    };
  } catch (error) {
    logger.error({
      event: "NEWS_PROVIDER_FINNHUB_FAILED",
      symbol,
      message: error.message,
    });
    throw new Error(`NEWS_DATA_UNAVAILABLE: ${symbol}`);
  }
};

/**
 * Deterministic Keyword-Based Sentiment Analysis
 */
const classifySentiment = (text) => {
  const bullishWords = ['growth', 'profit', 'surges', 'buy', 'bull', 'upgrade', 'expansion', 'record', 'outperform'];
  const bearishWords = ['loss', 'decline', 'falls', 'sell', 'bear', 'downgrade', 'contraction', 'inflation', 'underperform'];

  const lowerText = text.toLowerCase();
  let score = 0;

  bullishWords.forEach(w => { if (lowerText.includes(w)) score++; });
  bearishWords.forEach(w => { if (lowerText.includes(w)) score--; });

  if (score > 0) return 'BULLISH';
  if (score < 0) return 'BEARISH';
  return 'NEUTRAL';
};

module.exports = { getNews };
