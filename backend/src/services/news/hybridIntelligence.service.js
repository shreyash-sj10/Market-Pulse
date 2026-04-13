const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  createUnavailableStatus,
  createValidStatus,
  isValidStatus,
} = require("../../constants/intelligenceStatus");

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
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", 
      generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());
    if (data?.sentimentScore === undefined || !data?.explanation) {
      return createUnavailableStatus("AI_INVALID_RESPONSE");
    }
    return {
       ...createValidStatus(),
       ...data,
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
    - CONFLICT RESOLUTION: Resolve contradictions into ONE view.
    - No vague language. No raw signal dumps.
    
    OUTPUT FORMAT (JSON):
    {
      "explanation": "Reasoning why one side dominates, highlighting the key driver",
      "keyDriver": "Specific event/data point",
      "sentimentScore": -10 to +10,
      "aiSummary": "Final dominance verdict"
    }`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
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

// Step 4 & 5: Weighted Scoring & Verdict (RULE ENGINE)
const applyDeterministicRules = (consensusSignals, aiConsensus) => {
  if (!Array.isArray(consensusSignals) || consensusSignals.length === 0) {
    return createUnavailableStatus("NO_MARKET_SIGNALS");
  }

  let weightedScore = 0;
  let totalConfidence = 0;
  
  const scopeWeights = { MACRO: 1.5, SECTOR: 1.2, STOCK: 1.0 };

  for (const s of consensusSignals) {
    if (s.confidence === undefined || s.confidence === null) {
      return createUnavailableStatus("INSUFFICIENT_MARKET_DATA");
    }
    const dir = s.impact === "BULLISH" ? 1 : s.impact === "BEARISH" ? -1 : 0;
    const weight = scopeWeights[s.scope] || 1.0;
    const conf = s.confidence;
    
    weightedScore += dir * conf * weight;
    totalConfidence += conf;
  }

  const avgConfidence = Math.min(Math.round(totalConfidence / (consensusSignals.length || 1)), 98);
  const aiBias = isValidStatus(aiConsensus)
    ? aiConsensus.sentimentScore
    : (weightedScore / (consensusSignals.length || 1) / 10);
  
  // Suggested Bias Logic
  let verdict = "WAIT";
  const riskWarnings = [];
  
  // Deterministic Thresholds
  if (weightedScore > 60 || aiBias > 6) verdict = "BUY";
  else if (weightedScore < -60 || aiBias < -6) verdict = "AVOID";
  else verdict = "WAIT";

  if (avgConfidence < 60) riskWarnings.push("PRECISION VOID: High data variance.");
  if (consensusSignals.length < 2) riskWarnings.push("RELIANCE RISK: Single transmission node.");

  return {
    ...createValidStatus(),
    verdict,
    confidenceScore: avgConfidence,
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
