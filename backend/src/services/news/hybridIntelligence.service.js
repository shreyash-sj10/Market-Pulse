const { getGenerativeModel } = require("../../utils/geminiSingleton");
const {
  createUnavailableStatus,
  createValidStatus,
  isValidStatus,
} = require("../../constants/intelligenceStatus");
const { shouldSoftenStrongVerdict, INSUFFICIENT_DATA } = require("../../constants/intelligenceDataPolicy");
const {
  computeUnifiedConfidence0to100,
  strengthFromSentiment10,
  clamp01,
} = require("../../utils/unifiedConfidence");

/**
 * MASTER HYBRID TRADE EXECUTION ENGINE
 * AI: Interpretive Reasoning
 * RULES: Deterministic Execution
 */

// Step 1: Raw News -> AI Interpretation
const interpretMarketNuance = async (headline, summary) => {
  if (!process.env.GEMINI_API_KEY) return createUnavailableStatus("AI_UNAVAILABLE");
  if (!headline) return createUnavailableStatus("INSUFFICIENT_MARKET_DATA");

  const prompt = `You are a Senior Market Reasoning AI.
    Headline: ${headline}
    Summary: ${summary}
    
    Interpret the nuanced meaning and directional sentiment.
    - sentimentScore: -10 to +10
    - explanation: Clear market reasoning (1-2 lines)
    
    RULES: DO NOT output BUY or SELL. Output facts and logical sentiment only.
    Format: JSON`;

  try {
    const model = getGenerativeModel({ responseMimeType: "application/json" });
    if (!model) return createUnavailableStatus("AI_UNAVAILABLE");
    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());
    if (data?.sentimentScore === undefined || !data?.explanation) {
      return createUnavailableStatus("AI_INVALID_RESPONSE");
    }
    const sentiment = Number(data.sentimentScore);
    const signalStrength = strengthFromSentiment10(sentiment);
    const textLen = String(data.explanation || "").length;
    const dataCompleteness = clamp01(textLen > 80 ? 0.95 : textLen > 20 ? 0.75 : 0.5);
    const confidence = computeUnifiedConfidence0to100({
      signalStrength,
      signalAgreement: 0.45,
      dataCompleteness,
    });
    return {
       ...createValidStatus(),
       ...data,
       confidence,
       reasoning: data.explanation // For backward compatibility if needed
    };
  } catch (error) {
    return createUnavailableStatus("AI_UNAVAILABLE");
  }
};

// Step 3: Multiple signals -> AI Consensus Layer
const interpretConsensusNuance = async (headlines, sector) => {
  if (!process.env.GEMINI_API_KEY) return createUnavailableStatus("AI_UNAVAILABLE");
  if (!headlines.length) return createUnavailableStatus("INSUFFICIENT_MARKET_DATA");

  const prompt = `You are a Senior Strategic Analyst.
    Sector context: ${sector}
    Input Nodes:
    ${headlines.join("\n- ")}
    
    TASK:
    1. Determine WHICH side dominates the narrative and WHY.
    2. Identify the single "Key Driver" behind the consensus.
    3. Summarize into a unified explanation (1-2 lines).
    
    RULES:
    - Describe tensions between nodes; do NOT collapse into a trade directive (no BUY/SELL).
    - sentimentScore is narrative lean only (-10 bearish .. +10 bullish), not an execution order.
    - No vague language. No raw signal dumps.
    
    OUTPUT FORMAT (JSON):
    {
      "explanation": "Reasoning why one side dominates, highlighting the key driver",
      "keyDriver": "Specific event/data point",
      "sentimentScore": -10 to +10,
      "aiSummary": "Final dominance verdict"
    }`;

  try {
    const model = getGenerativeModel({ responseMimeType: "application/json" });
    if (!model) return createUnavailableStatus("AI_UNAVAILABLE");
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    if (parsed?.sentimentScore === undefined || !parsed?.explanation || !parsed?.keyDriver) {
      return createUnavailableStatus("AI_INVALID_RESPONSE");
    }
    return {
      ...createValidStatus(),
      ...parsed,
    };
  } catch (error) {
    return createUnavailableStatus("AI_UNAVAILABLE");
  }
};

/**
 * Collapse duplicate headlines so repeated syndication does not multiply vote weight.
 */
const dedupeConsensusSignalsByHeadline = (signals) => {
  const byKey = new Map();
  for (const s of signals) {
    const key = String(s.event || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev || Number(s.confidence) > Number(prev.confidence)) {
      byKey.set(key, s);
    }
  }
  return [...byKey.values()];
};

// Step 4 & 5: Weighted Scoring & Verdict (RULE ENGINE)
const applyDeterministicRules = (consensusSignals, aiConsensus) => {
  if (!Array.isArray(consensusSignals) || consensusSignals.length === 0) {
    return createUnavailableStatus("NO_MARKET_SIGNALS");
  }

  const consensusSignalsDeduped = dedupeConsensusSignalsByHeadline(consensusSignals);
  if (consensusSignalsDeduped.length === 0) {
    return createUnavailableStatus("NO_MARKET_SIGNALS");
  }

  let weightedScore = 0;
  let totalConfidence = 0;
  
  const scopeWeights = { MACRO: 1.5, SECTOR: 1.2, STOCK: 1.0 };

  for (const s of consensusSignalsDeduped) {
    if (s.confidence === undefined || s.confidence === null) {
      return createUnavailableStatus("INSUFFICIENT_MARKET_DATA");
    }
    const dir = s.impact === "BULLISH" ? 1 : s.impact === "BEARISH" ? -1 : 0;
    const weight = scopeWeights[s.scope] || 1.0;
    const conf = s.confidence;
    
    weightedScore += dir * conf * weight;
    totalConfidence += conf;
  }

  const n = consensusSignalsDeduped.length;
  const avgConfidence = Math.min(Math.round(totalConfidence / (n || 1)), 98);
  /** LLM narrative lean — never used to override deterministic rule verdict (Phase 3 boundary). */
  const narrativeLean = isValidStatus(aiConsensus) ? aiConsensus.sentimentScore : null;

  let verdict = "WAIT";
  const riskWarnings = [];

  // Deterministic thresholds ONLY (interpretation layer cannot flip verdict)
  if (weightedScore > 60) verdict = "BUY";
  else if (weightedScore < -60) verdict = "AVOID";
  else verdict = "WAIT";

  // M-07: Strong directional verdicts (BUY/AVOID) require sufficient signal depth.
  // Enforced primarily by shouldSoftenStrongVerdict below (default minSignals=2,
  // minAvgConfidence=52). Explicit n<2 guard documents the contract for auditors.
  if (n < 2 && (verdict === "BUY" || verdict === "AVOID")) {
    verdict = "WAIT";
    riskWarnings.push(`${INSUFFICIENT_DATA}: directional verdict requires at least 2 independent signals.`);
  }

  if (avgConfidence < 60) riskWarnings.push("PRECISION VOID: High data variance.");
  if (n < 2) riskWarnings.push("RELIANCE RISK: Single transmission node.");

  if (
    shouldSoftenStrongVerdict({ signalCount: n, avgConfidence }) &&
    (verdict === "BUY" || verdict === "AVOID")
  ) {
    verdict = "WAIT";
    riskWarnings.push(`${INSUFFICIENT_DATA}: strong directional verdict withheld — depth or confidence too low.`);
  }

  const signalStrength = strengthFromSentiment10(
    typeof narrativeLean === "number" ? narrativeLean : weightedScore / Math.max(n, 1) / 10
  );
  const signalAgreement = n >= 3 ? 0.85 : n >= 2 ? 0.68 : 0.42;
  const dataCompleteness = clamp01(avgConfidence / 100);
  const unifiedConfidenceScore = computeUnifiedConfidence0to100({
    signalStrength,
    signalAgreement,
    dataCompleteness,
  });

  return {
    ...createValidStatus(),
    verdict,
    confidenceScore: avgConfidence,
    unifiedConfidenceScore,
    narrativeLean,
    riskWarnings,
    reasoning: isValidStatus(aiConsensus) ? aiConsensus.explanation : "Consensus derived via weighted rule processing.",
    keyDriver: isValidStatus(aiConsensus) ? aiConsensus.keyDriver : null,
  };
};

module.exports = {
  interpretMarketNuance,
  interpretConsensusNuance,
  applyDeterministicRules
};
