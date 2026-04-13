const { analyzeNews } = require('../services/aiExplanation.service');
const {
  createValidStatus,
  createUnavailableStatus,
  isValidStatus,
} = require("../constants/intelligenceStatus");

/**
 * MARKET INTELLIGENCE ENGINE
 * Reconstructs raw news data into structured, institutional intelligence.
 * Deterministic sentiment derivation with AI-assisted driver summarization.
 */
const analyzeMarketIntelligence = async (articles, symbol = "GENERAL") => {
  if (!articles || articles.length === 0) {
    return {
      ...createUnavailableStatus("INSUFFICIENT_MARKET_DATA"),
      symbol,
      sentiment: null,
      confidence: null,
      drivers: [],
      warnings: ["DATA_SCARCITY"],
      articleCount: 0,
      lastUpdated: new Date()
    };
  }

  // Institutional Keyword Mapping
  const bullishKeywords = ["profit", "surge", "growth", "high", "upgrade", "positive", "bull", "rally", "gain", "optimism", "beat", "dividend"];
  const bearishKeywords = ["loss", "fall", "crash", "low", "downgrade", "negative", "bear", "panic", "decline", "warning", "miss", "debt"];

  let bullishCount = 0;
  let bearishCount = 0;
  const rawContext = [];
  const deterministicDrivers = [];

  articles.forEach(article => {
    const text = ((article.title || "") + " " + (article.description || "")).toLowerCase();
    let matches = 0;

    bullishKeywords.forEach(k => {
      if (text.includes(k)) {
        bullishCount++;
        matches++;
      }
    });

    bearishKeywords.forEach(k => {
      if (text.includes(k)) {
        bearishCount++;
        matches++;
      }
    });

    if (matches > 0) {
      rawContext.push(article.title);
      if (deterministicDrivers.length < 5) {
        deterministicDrivers.push(article.title);
      }
    }
  });

  // Deterministic Sentiment Decision Logic
  let sentiment = "MIXED";
  if (bullishCount > bearishCount * 1.5) {
    sentiment = "BULLISH";
  } else if (bearishCount > bullishCount * 1.5) {
    sentiment = "BEARISH";
  }

  // Resolve Contradiction (If both signals are strong and balanced)
  if (bullishCount > 3 && bearishCount > 3 && Math.abs(bullishCount - bearishCount) < Math.max(bullishCount, bearishCount) * 0.3) {
    sentiment = "MIXED";
  }

  // AI Summary Layer (Restricted to driver summarization)
  const aiNews = await analyzeNews(
    rawContext.length > 0 ? rawContext.slice(0, 15) : articles.slice(0, 5).map(a => a.title)
  );

  const totalHits = bullishCount + bearishCount;
  if (totalHits === 0) {
    return {
      ...createUnavailableStatus("INSUFFICIENT_MARKET_DATA"),
      symbol,
      sentiment: null,
      confidence: null,
      drivers: [],
      warnings: ["NO_CLASSIFIED_SIGNALS"],
      articleCount: articles.length,
      lastUpdated: new Date(),
      ai: aiNews
    };
  }

  const confidence = Number((Math.min(100, (Math.abs(bullishCount - bearishCount) / totalHits) * 100 + 40) / 100).toFixed(2));

  return {
    ...createValidStatus(),
    symbol,
    sentiment,
    confidence,
    // PHASE 3 FIX: Deterministic drivers are PRIMARY. Always present, never empty when signals exist.
    drivers: deterministicDrivers,
    warnings: bearishCount > 8 ? ["Heavy negative cluster detected", "Institutional sentiment cooling"] : [],
    articleCount: articles.length,
    lastUpdated: new Date(),
    // AI is SECONDARY overlay — read-only, non-critical
    ai: aiNews
  };
};

module.exports = { analyzeMarketIntelligence };
