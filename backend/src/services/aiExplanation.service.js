const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  createValidStatus,
  createUnavailableStatus,
} = require("../constants/intelligenceStatus");

const withTimeout = (promise, timeoutMs = 12000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("AI_TIMEOUT")), timeoutMs)),
  ]);

const buildUnavailable = (reason) => ({
  ...createUnavailableStatus(reason),
});

const generateExplanation = async (riskScore, mistakeTags, context = {}) => {
  if (!process.env.GEMINI_API_KEY) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
  if (!Number.isFinite(Number(riskScore)) || !Array.isArray(mistakeTags)) {
    return buildUnavailable("INSUFFICIENT_INPUT_DATA");
  }

  const { symbol, type, reason, userThinking } = context;
  const prompt = `You are a professional trading psychologist and risk analyst.
Context:
- Symbol: ${symbol || "UNKNOWN"}
- Trade Type: ${type || "UNKNOWN"}
- Risk Score: ${riskScore}/100
- Mistake Tags: ${mistakeTags.length > 0 ? mistakeTags.join(", ") : "None"}
- User's Stated Reason: ${reason || "Not provided"}
- User's Internal Thinking: ${userThinking || "Not provided"}

Produce JSON:
1. explanation: concise technical risk explanation.
2. behaviorAnalysis: psychological analysis.
Response MUST be valid JSON.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await withTimeout(model.generateContent(prompt));
    const parsed = JSON.parse(result.response.text());

    if (!parsed?.explanation || !parsed?.behaviorAnalysis) {
      return buildUnavailable("AI_INVALID_RESPONSE");
    }

    return {
      ...createValidStatus(),
      explanation: parsed.explanation,
      behaviorAnalysis: parsed.behaviorAnalysis,
    };
  } catch (error) {
    const logger = require("../lib/logger");
    logger.error({ action: "AI_GENERATION_FAILED", error: error.message, model: "gemini-1.5-flash" });
    return buildUnavailable("AI_UNAVAILABLE");
  }
};

const generateMarketInsight = async (symbol, technicals, newsItems) => {
  if (!process.env.GEMINI_API_KEY) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
  if (!symbol || !technicals || !Array.isArray(newsItems) || newsItems.length === 0) {
    return buildUnavailable("INSUFFICIENT_MARKET_DATA");
  }

  const prompt = `You are a Senior Quantitative Analyst at a top-tier hedge fund.
Context:
- Asset: ${symbol}
- Technicals: RSI=${technicals.rsi}, Change=${technicals.change}%, Volume=${technicals.volume}
- News Headlines: ${newsItems.map((n) => n.title).join(" | ")}

Return JSON with signal, analysis, confidence, keyRisk.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await withTimeout(model.generateContent(prompt));
    const parsed = JSON.parse(result.response.text());

    if (!parsed?.signal || !parsed?.analysis || parsed?.confidence === undefined) {
      return buildUnavailable("AI_INVALID_RESPONSE");
    }

    return {
      ...createValidStatus(),
      signal: parsed.signal,
      analysis: parsed.analysis,
      confidence: parsed.confidence,
      keyRisk: parsed.keyRisk,
    };
  } catch (error) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
};

const parseTradeIntent = async (rawIntent) => {
  if (!process.env.GEMINI_API_KEY) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
  if (!rawIntent || !String(rawIntent).trim()) {
    return buildUnavailable("INSUFFICIENT_INTENT_DATA");
  }

  const prompt = `You are a trading strategy classifier.
User Intent: "${rawIntent}"

Extract JSON fields: strategy, confidence, keywords.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await withTimeout(model.generateContent(prompt));
    const parsed = JSON.parse(result.response.text());

    if (!parsed?.strategy || parsed?.confidence === undefined || !Array.isArray(parsed?.keywords)) {
      return buildUnavailable("AI_INVALID_RESPONSE");
    }

    return {
      ...createValidStatus(),
      strategy: parsed.strategy,
      confidence: parsed.confidence,
      keywords: parsed.keywords,
    };
  } catch (error) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
};

const generateTradeReviewSummary = async (reviewData, tradeContext) => {
  if (!process.env.GEMINI_API_KEY) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
  if (!reviewData || !tradeContext) {
    return buildUnavailable("INSUFFICIENT_INPUT_DATA");
  }

  const { verdict, strategyDescription } = reviewData;
  const { symbol, pnl, missedOpportunity } = tradeContext;

  const prompt = `You are a Performance Coach for Institutional Traders.
Symbol: ${symbol}
Verdict: ${verdict}
Strategy: ${strategyDescription}
PnL: ${pnl}
Missed Opp: ${missedOpportunity?.maxPotentialProfit || 0}

Write a concise post-mortem summary.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await withTimeout(model.generateContent(prompt));

    return {
      ...createValidStatus(),
      summary: result.response.text().trim(),
    };
  } catch (err) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
};

const interpretMarketSignal = async (headlines, context = {}) => {
  if (!process.env.GEMINI_API_KEY) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
  if (!Array.isArray(headlines) || headlines.length === 0) {
    return buildUnavailable("INSUFFICIENT_MARKET_DATA");
  }

  const prompt = `You are a Senior Macro Intelligence AI.
Headlines: ${headlines.join(" | ")}
Sector: ${context.sector || "General"}

Return JSON: nuance, sentimentScore, reasoning, confidence.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await withTimeout(model.generateContent(prompt));
    const parsed = JSON.parse(result.response.text());

    if (!parsed?.nuance || parsed?.confidence === undefined || parsed?.sentimentScore === undefined) {
      return buildUnavailable("AI_INVALID_RESPONSE");
    }

    return {
      ...createValidStatus(),
      nuance: parsed.nuance,
      sentimentScore: parsed.sentimentScore,
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
    };
  } catch (error) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
};

const generateFinalTradeCall = async (inputs, context = {}) => {
  const verdict = context.verdict;
  if (!verdict) {
    return buildUnavailable("INSUFFICIENT_INPUT_DATA");
  }
  if (!process.env.GEMINI_API_KEY) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
  if (!inputs?.market || !inputs?.setup || !inputs?.behavior || !inputs?.risk || inputs?.finalScore === undefined || inputs?.finalScore === null) {
    return buildUnavailable("INSUFFICIENT_INPUT_DATA");
  }

  const { market, setup, behavior, risk, finalScore } = inputs;
  const prompt = `You are a Chief Investment Officer.
Market Context:
- Direction: ${market.direction}, Confidence: ${market.confidence}, Reason: ${market.reason}
Trade Setup:
- Type: ${setup.type}, Quality: ${setup.score}, Reason: ${setup.reason}
Behavioral State:
- Risk: ${behavior.risk}, Score: ${behavior.score}, Reason: ${behavior.reason}
Risk Exposure:
- Level: ${risk.level}, Score: ${risk.score}, Reason: ${risk.reason}
Final Score: ${finalScore}
Final Verdict: ${verdict}

Return JSON with reasoning and suggestedAction.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await withTimeout(model.generateContent(prompt));
    const parsed = JSON.parse(result.response.text());

    if (!parsed?.reasoning || !parsed?.suggestedAction) {
      return buildUnavailable("AI_INVALID_RESPONSE");
    }

    return {
      ...createValidStatus(),
      finalCall: verdict,
      confidence: finalScore,
      reasoning: parsed.reasoning,
      suggestedAction: parsed.suggestedAction,
    };
  } catch (error) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
};

const summarizeMarketDrivers = async (headlines) => {
  if (!process.env.GEMINI_API_KEY) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
  if (!Array.isArray(headlines) || headlines.length === 0) {
    return buildUnavailable("INSUFFICIENT_MARKET_DATA");
  }

  const prompt = `You are a financial news summarizer.
Headlines: ${headlines.join(" | ")}
Return JSON array of 3 concise market drivers.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await withTimeout(model.generateContent(prompt));
    const parsed = JSON.parse(result.response.text());
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return buildUnavailable("AI_INVALID_RESPONSE");
    }

    return {
      ...createValidStatus(),
      drivers: parsed,
    };
  } catch (error) {
    return buildUnavailable("AI_UNAVAILABLE");
  }
};

module.exports = {
  generateExplanation,
  generateMarketInsight,
  parseTradeIntent,
  generateTradeReviewSummary,
  interpretMarketSignal,
  generateFinalTradeCall,
  summarizeMarketDrivers,
};
