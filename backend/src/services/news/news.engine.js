const finnhubProvider = require('./news.provider.finnhub');
const yahooProvider = require('./news.provider.yahoo');
const cache = require('./news.cache');
const classificationEngine = require('./classification.engine');
const hybridService = require('./hybridIntelligence.service');
const { toHoldingsArray, toHoldingsLookup } = require('../../utils/holdingsNormalizer');
const {
  isValidStatus,
} = require("../../constants/intelligenceStatus");

/**
 * HYBRID TRADE EXECUTION ENGINE (NEWS/SIGNAL LAYER)
 * Pipeline: Interpretation (AI) -> Classification (Rule) -> Consensus (AI) -> Verdict (Rule)
 */
const getProcessedNews = async (symbol, userHoldings = {}) => {
  const holdingsLookup = toHoldingsLookup(userHoldings);
  const previousData = cache.getItems(symbol);
  
  // 1. Fetch via Waterfall
  let rawNews = [];
  try {
    const fetchPromise = yahooProvider.getNews(symbol);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500));
    rawNews = await Promise.race([fetchPromise, timeoutPromise]) || [];
    if (!rawNews.length) rawNews = await finnhubProvider.getNews(symbol);
  } catch (err) {
    try { rawNews = await finnhubProvider.getNews(symbol); } catch (fErr) { rawNews = []; }
  }

  if (!Array.isArray(rawNews) || rawNews.length === 0) {
    return {
      symbol,
      status: "UNAVAILABLE",
      reason: "NO_MARKET_SIGNALS",
      signals: [generateUnavailableSignal(symbol, "NO_MARKET_SIGNALS")],
      stats: { total: 0, lastUpdated: new Date().toISOString() },
    };
  }

  // 2. Step 1 & 2: Raw News -> AI Interpretation & Rule Classification
  const initialSignals = await Promise.all(rawNews.slice(0, 10).map(async (item, idx) => {
    const rawHeadline = (item.headline || item.title || "").trim();
    if (!rawHeadline) return null;

    // AI Step 1: Interpret Nuance
    const aiNuance = await hybridService.interpretMarketNuance(rawHeadline, item.summary);
    if (!isValidStatus(aiNuance)) return null;

    // Rule Step 2: Classification Mapping
    const text = `${rawHeadline} ${item.summary || ""}`;
    const country = classificationEngine.detectCountry(text);
    const relevance = classificationEngine.getRelevance(symbol, text, holdingsLookup);
    const sector = classificationEngine.mapSector(text);

    return {
      id: `hyp-sig-${idx}`,
      event: rawHeadline,
      nuance: aiNuance.nuance,
      impact: (aiNuance.sentimentScore > 2) ? "BULLISH" : (aiNuance.sentimentScore < -2) ? "BEARISH" : "NEUTRAL",
      confidence: aiNuance.confidence,
      sector,
      relevance,
      time: new Date(item.timestamp || Date.now()).toISOString(),
      symbols: [symbol.toUpperCase()]
    };
  }));

  const validSignals = initialSignals.filter(s => !!s);
  if (!validSignals.length) {
    return {
      symbol,
      status: "UNAVAILABLE",
      reason: "NO_MARKET_SIGNALS",
      signals: [generateUnavailableSignal(symbol, "NO_MARKET_SIGNALS")],
      stats: { total: 0, lastUpdated: new Date().toISOString() },
    };
  }
  const signals = validSignals;

  // 3. Step 3: Multiple signals -> AI Consensus Layer
  const sectorGroups = {};
  signals.forEach(s => {
    const key = s.sector || "GENERAL";
    if (!sectorGroups[key]) sectorGroups[key] = [];
    sectorGroups[key].push(s);
  });

  const finalDecisionNodes = await Promise.all(Object.entries(sectorGroups).map(async ([sector, sectorSignals]) => {
     // AI Step 3: AI Consensus Layer
     const headlines = sectorSignals.map(s => s.event);
     const aiConsensus = await hybridService.interpretConsensusNuance(headlines, sector);

     // Rule Step 4 & 5: Deterministic Scoring & Verdict
     const finalDecision = hybridService.applyDeterministicRules(sectorSignals, aiConsensus);
     if (!isValidStatus(finalDecision)) {
       return generateUnavailableSignal(symbol, finalDecision.reason || "NO_MARKET_SIGNALS", sector);
     }

     // Temporal delta
     const prev = previousData?.signals?.find(p => p.sector === sector);
     let temporal = "STABLE";
     if (prev) {
        if (finalDecision.verdict === "BUY" && prev.verdict !== "BUY") temporal = "IMPROVING";
        if (finalDecision.verdict === "AVOID" && prev.verdict !== "AVOID") temporal = "WEAKENING";
     }

     return {
        id: `consensus-${sector}`,
        event: `${sector} HYBRID INTELLIGENCE`,
        mechanism: isValidStatus(aiConsensus) ? aiConsensus.explanation : "Consensus derived via weighted rule processing.",
        judgment: finalDecision.reasoning,
        keyDriver: finalDecision.keyDriver,
        verdict: finalDecision.verdict,
        impact: finalDecision.verdict === "BUY" ? "BULLISH" : finalDecision.verdict === "AVOID" ? "BEARISH" : "NEUTRAL",
        confidence: finalDecision.confidenceScore,
        riskWarnings: finalDecision.riskWarnings,
        temporal,
        sector,
        symbols: [symbol.toUpperCase()],
        signalCount: sectorSignals.length,
        isConsensus: true,
        status: "VALID",
     };
  }));

  const response = {
    symbol,
    status: "VALID",
    signals: finalDecisionNodes,
    stats: { total: finalDecisionNodes.length, lastUpdated: new Date().toISOString() }
  };

  cache.setItems(symbol, response);
  return response;
};

/**
 * PORTFOLIO INTELLIGENCE (Strict Decision Mode)
 */
const getPortfolioNews = async (userHoldings = {}) => {
  const holdingsArray = toHoldingsArray(userHoldings);
  const holdingsLookup = toHoldingsLookup(userHoldings);
  const symbols = holdingsArray.map((h) => h.symbol).slice(0, 15);
  
  if (!symbols.length) {
    return {
      status: "UNAVAILABLE",
      reason: "NO_PORTFOLIO_ASSETS",
      signals: [generateUnavailableSignal("PORTFOLIO", "NO_PORTFOLIO_ASSETS", "GENERAL")],
    };
  }

  const results = await Promise.allSettled(symbols.map(s => getProcessedNews(s, holdingsLookup)));
  const allSignals = results.filter(r => r.status === 'fulfilled').map(r => r.value.signals).flat();
  
  // Clean signals for Portfolio (Unique by symbol)
  const uniqueBySymbol = [];
  const seen = new Set();
  allSignals.forEach(s => {
     const sym = s.symbols[0];
     if (!seen.has(sym)) {
        seen.add(sym);
        uniqueBySymbol.push(s);
     }
  });

  if (!uniqueBySymbol.length) {
    return {
      status: "UNAVAILABLE",
      reason: "NO_MARKET_SIGNALS",
      signals: [generateUnavailableSignal("PORTFOLIO", "NO_MARKET_SIGNALS", "GENERAL")],
    };
  }

  return { status: "VALID", signals: uniqueBySymbol.slice(0, 30) };
};

const generateUnavailableSignal = (symbol, reason, sector = classificationEngine.mapSector(symbol)) => ({
  id: `unavailable-${symbol}-${reason}`,
  event: `${symbol} INTELLIGENCE UNAVAILABLE`,
  mechanism: `Data not available (${reason}).`,
  judgment: "Decision limited due to missing signals.",
  verdict: "WAIT",
  status: "UNAVAILABLE",
  reason,
  impact: null,
  confidence: null,
  scope: "MARKET",
  sector,
  time: new Date().toISOString(),
  temporal: "STABLE",
  relevance: "MACRO"
});

const getTopNews = async () => {
  // Broad market context defaulted to Nifty 50 index
  return getProcessedNews("^NSEI");
};

module.exports = { getProcessedNews, getPortfolioNews, getTopNews };
