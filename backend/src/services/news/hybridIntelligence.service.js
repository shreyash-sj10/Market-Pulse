const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * MASTER HYBRID TRADE EXECUTION ENGINE
 * AI: Interpretive Reasoning
 * RULES: Deterministic Execution
 */

// Step 1: Raw News -> AI Interpretation
const interpretMarketNuance = async (headline, summary) => {
  if (!process.env.GEMINI_API_KEY) return null;

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
    return {
       ...data,
       reasoning: data.explanation // For backward compatibility if needed
    };
  } catch (error) {
    return null;
  }
};

// Step 3: Multiple signals -> AI Consensus Layer
const interpretConsensusNuance = async (headlines, sector) => {
  if (!process.env.GEMINI_API_KEY || !headlines.length) return null;

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
    return JSON.parse(result.response.text());
  } catch (error) {
    return null;
  }
};

// Step 4 & 5: Weighted Scoring & Verdict (RULE ENGINE)
const applyDeterministicRules = (consensusSignals, aiConsensus) => {
  let weightedScore = 0;
  let totalConfidence = 0;
  
  const scopeWeights = { MACRO: 1.5, SECTOR: 1.2, STOCK: 1.0 };

  consensusSignals.forEach(s => {
    const dir = s.impact === "BULLISH" ? 1 : s.impact === "BEARISH" ? -1 : 0;
    const weight = scopeWeights[s.scope] || 1.0;
    const conf = s.confidence || 50;
    
    weightedScore += dir * conf * weight;
    totalConfidence += conf;
  });

  const avgConfidence = Math.min(Math.round(totalConfidence / (consensusSignals.length || 1)), 98);
  const aiBias = aiConsensus?.sentimentScore || (weightedScore / (consensusSignals.length || 1) / 10);
  
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
    verdict,
    confidenceScore: avgConfidence,
    riskWarnings,
    reasoning: aiConsensus?.explanation || "Consensus derived via weighted rule processing.",
    keyDriver: aiConsensus?.keyDriver || "Systemic transmission patterns."
  };
};

module.exports = {
  interpretMarketNuance,
  interpretConsensusNuance,
  applyDeterministicRules
};
