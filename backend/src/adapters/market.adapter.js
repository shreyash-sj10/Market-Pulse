const { adaptAIResponse } = require("./ai.adapter");

const adaptMarket = (quotesData, newsData) => {
  const quotes = Array.isArray(quotesData) 
    ? quotesData.map(q => ({
        symbol: q.symbol || "UNKNOWN",
        pricePaise: q.pricePaise || 0,
        source: q.source || "FALLBACK",
        isFallback: Boolean(q.isFallback)
      }))
    : [];

  const news = Array.isArray(newsData?.signals)
    ? newsData.signals.map(s => ({
        title: s.event || "News Event",
        ai: adaptAIResponse(s.ai)
      }))
    : [];

  return {
    quotes,
    news
  };
};

module.exports = { adaptMarket };
