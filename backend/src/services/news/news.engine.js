const finnhubProvider = require('./news.provider.finnhub');
const yahooProvider = require('./news.provider.yahoo');
const cache = require('./news.cache');
const classificationEngine = require('./classification.engine');
const hybridService = require('./hybridIntelligence.service');
const { toHoldingsArray, toHoldingsLookup } = require('../../utils/holdingsNormalizer');

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

  // 2. Step 1 & 2: Raw News -> AI Interpretation & Rule Classification
  const initialSignals = await Promise.all(rawNews.slice(0, 10).map(async (item, idx) => {
    const rawHeadline = (item.headline || item.title || "").trim();
    if (!rawHeadline) return null;

    // AI Step 1: Interpret Nuance
    const aiNuance = await hybridService.interpretMarketNuance(rawHeadline, item.summary);

    // Rule Step 2: Classification Mapping
    const text = `${rawHeadline} ${item.summary || ""}`;
    const country = classificationEngine.detectCountry(text);
    const relevance = classificationEngine.getRelevance(symbol, text, holdingsLookup);
    const sector = classificationEngine.mapSector(text);

    return {
      id: `hyp-sig-${idx}`,
      event: rawHeadline,
      nuance: aiNuance?.nuance || "Nuance extraction on standby.",
      impact: (aiNuance?.sentimentScore > 2) ? "BULLISH" : (aiNuance?.sentimentScore < -2) ? "BEARISH" : "NEUTRAL",
      confidence: aiNuance?.confidence || 60,
      sector,
      relevance,
      time: new Date(item.timestamp || Date.now()).toISOString(),
      symbols: [symbol.toUpperCase()]
    };
  }));

  const validSignals = initialSignals.filter(s => !!s);
  const signals = validSignals.length ? validSignals : [generateFallbackSignal(symbol)];

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
        mechanism: aiConsensus?.explanation || "Standard directional transmission.",
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
        isConsensus: true
     };
  }));

  const response = {
    symbol,
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
      signals: [{
        id: 'portfolio-empty',
        event: 'PORTFOLIO VESTIBULE EMPTY',
        mechanism: 'No active asset nodes detected in terminal vault.',
        judgment: 'Deploy liquidity to activate portfolio monitoring.',
        verdict: 'WAIT',
        impact: 'NEUTRAL',
        confidence: 100,
        scope: 'MARKET',
        sector: 'GENERAL',
        temporal: 'STABLE',
        relevance: 'DIRECT'
      }] 
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

  return { signals: uniqueBySymbol.slice(0, 30) };
};

const generateFallbackSignal = (symbol) => ({
  id: `fallback-${symbol}`,
  event: `${symbol} STRUCTURAL PULSE BASELINE`,
  mechanism: "Market in consolidation phase. No high-impact triggers detected.",
  judgment: "Maintain risk-neutral posture until directional vector clears.",
  verdict: "WAIT",
  impact: "NEUTRAL",
  confidence: 60,
  scope: "MARKET",
  sector: classificationEngine.mapSector(symbol),
  temporal: "STABLE",
  relevance: "MACRO"
});

module.exports = { getProcessedNews, getPortfolioNews };
