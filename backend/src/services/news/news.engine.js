const finnhubProvider = require('./news.provider.finnhub');
const yahooProvider = require('./news.provider.yahoo');
const cache = require('./news.cache');

/**
 * DETERMINISTIC SENTIMENT ANALYSIS
 */
const classifySentiment = (headline) => {
  const text = headline.toLowerCase();
  
  const positive = ["profit", "growth", "upgrade", "buy", "outperform", "bullish", "jump", "success", "gain"];
  const negative = ["loss", "decline", "downgrade", "sell", "underperform", "bearish", "drop", "failure", "slump"];

  if (positive.some(word => text.includes(word))) return "BULLISH";
  if (negative.some(word => text.includes(word))) return "BEARISH";
  
  return "NEUTRAL";
};

/**
 * PORTFOLIO-AWARE RELEVANCE
 */
const calculateRelevance = (symbol, userHoldings = {}, stockSector = "") => {
  const norm = symbol.toUpperCase().split('.')[0];
  if (userHoldings.hasOwnProperty(norm) || userHoldings.hasOwnProperty(`${norm}.NS`)) return "HIGH";
  
  return "LOW";
};

/**
 * CORE NEWS ENGINE
 * Orchestrates Providers, Cache, and Engineering logic
 */
const getProcessedNews = async (symbol, userHoldings = {}) => {
  // 1. Check Cache
  const cachedData = cache.getItems(symbol);
  if (cachedData) return cachedData;

  // 2. Fetch via Waterfall
  let rawNews = [];
  try {
    rawNews = await finnhubProvider.getNews(symbol);
  } catch (err) {
    try {
      rawNews = await yahooProvider.getNews(symbol);
    } catch (fallbackErr) {
      throw new Error("NEWS_SERVICE_UNAVAILABLE");
    }
  }

  if (!rawNews.length) return { sentimentSummary: "NEUTRAL", news: [] };

  // 3. Process & Normalize
  const processedNews = rawNews.map((item, idx) => {
    const sentiment = classifySentiment(item.headline);
    
    // Aesthetic fallback images based on sentiment
    const fallbackImages = {
      BULLISH: "https://images.unsplash.com/photo-1611974714158-f88c146996bd?auto=format&fit=crop&q=80&w=1000",
      BEARISH: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=1000",
      NEUTRAL: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=1000"
    };

    return {
      id: item.id || `news-${symbol}-${Date.now()}-${idx}`,
      title: item.headline,
      summary: item.summary,
      source: item.source,
      time: new Date(item.timestamp).toISOString(),
      url: item.url,
      image: item.image || fallbackImages[sentiment],
      sentiment,
      relevance: calculateRelevance(symbol, userHoldings)
    };
  });

  // 4. Calculate Summary Sentiment
  const bullishCount = processedNews.filter(n => n.sentiment === "BULLISH").length;
  const bearishCount = processedNews.filter(n => n.sentiment === "BEARISH").length;
  
  let sentimentSummary = "MIXED";
  if (bullishCount > bearishCount * 2) sentimentSummary = "POSSIBLY_POSITIVE";
  if (bearishCount > bullishCount * 2) sentimentSummary = "POSSIBLY_NEGATIVE";
  if (bullishCount === 0 && bearishCount === 0) sentimentSummary = "NEUTRAL";

  const result = {
    sentimentSummary,
    news: processedNews.slice(0, 10) // Limit to top 10 as per requirements
  };

  // 5. Store in Cache
  cache.setItems(symbol, result);

  return result;
};

/**
 * PORTFOLIO NEWS AGGREGATOR
 */
const getPortfolioNews = async (userHoldings = {}) => {
  // Limit to top 5 holdings to prevent API saturation
  const symbols = Object.keys(userHoldings).slice(0, 5);
  if (!symbols.length) return { news: [] };

  const results = await Promise.allSettled(
    symbols.map(s => getProcessedNews(s, userHoldings))
  );

  const allNews = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value.news)
    .filter(n => n.relevance === "HIGH")
    .sort((a, b) => b.timestamp - a.timestamp);

  return {
    news: allNews.slice(0, 5)
  };
};

/**
 * MACRO MARKET NEWS AGGREGATOR
 */
const getTopNews = async () => {
  // Use NIFTY 50 as the macro pulse
  return await getProcessedNews('NIFTY');
};

module.exports = { getProcessedNews, getPortfolioNews, getTopNews };
