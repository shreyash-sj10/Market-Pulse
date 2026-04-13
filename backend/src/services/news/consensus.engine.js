/**
 * HYBRID CONSENSUS ENGINE (DECISION MODE)
 * AI: Interprets nuance, resolves contradictions, provides reasoning.
 * RULES: Evaluates risk, scores quality, produce FINAL VERDICT.
 */
const calculateConsensus = (signals = [], aiInsight = null) => {
  if (!signals || signals.length === 0) return null;
  
  // 1. RULE ENGINE: Deterministic Metric Aggregation
  let totalScore = 0;
  let totalConfidence = 0;
  let bullishCount = 0;
  let bearishCount = 0;

  for (const s of signals) {
    const weight = s.impact === "BULLISH" ? 1 : s.impact === "BEARISH" ? -1 : 0;
    if (s.confidence === undefined || s.confidence === null) {
      return null;
    }
    const conf = s.confidence;
    totalScore += weight * conf;
    totalConfidence += conf;
    if (weight > 0) bullishCount++;
    else if (weight < 0) bearishCount++;
  }

  const conflict = bullishCount > 0 && bearishCount > 0;
  const avgConfidence = Math.min(Math.round(totalConfidence / signals.length) + (signals.length * 2), 98);
  
  // 2. AI INTERPRETATION (If provided)
  const reasoning = aiInsight?.reasoning;
  const nuance = aiInsight?.nuance;
  const aiSentiment = aiInsight?.sentimentScore ?? (totalScore / signals.length / 5);

  // 3. RULE ENGINE: Final Verdict & Risk Evaluation
  let verdict = "WAIT";
  const riskWarnings = [];
  
  if (conflict) {
    verdict = "WAIT";
    riskWarnings.push("HIGH VARIANCE: Divergent catalysts detected.");
  } else if (totalScore > 40 || aiSentiment > 7) {
    verdict = "BUY";
  } else if (totalScore < -40 || aiSentiment < -7) {
    verdict = "AVOID";
  } else {
    verdict = "CAUTION";
  }

  if (avgConfidence < 60) riskWarnings.push("LOW CLARITY: Precision threshold not met.");
  if (signals.length < 2) riskWarnings.push("LOW DENSITY: Single transmission risk.");

  const sector = signals[0].sector || "GENERAL";
  const assets = [...new Set(signals.map(s => s.symbols || []).flat())];

  return {
    id: `consensus-${sector}`,
    event: `${sector} HYBRID INTELLIGENCE`,
    mechanism: nuance,
    judgment: reasoning,
    verdict,
    impact: totalScore > 0 ? "BULLISH" : totalScore < 0 ? "BEARISH" : "NEUTRAL",
    confidence: avgConfidence,
    riskWarnings,
    sector: sector,
    symbols: assets,
    signalCount: signals.length,
    isConsensus: true,
    isAIInterpreted: !!aiInsight
  };
};

const aggregateByContext = (signals = [], keyExtractor = (s) => s.symbols[0]) => {
  const groups = {};
  signals.forEach(s => {
    const key = keyExtractor(s) || "GENERAL";
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return Object.values(groups).map(g => calculateConsensus(g)).filter(Boolean);
};

module.exports = { calculateConsensus, aggregateByContext };
