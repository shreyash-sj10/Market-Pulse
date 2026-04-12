const { GoogleGenerativeAI } = require("@google/generative-ai");

const generateDeterministicExplanation = (riskScore, mistakeTags) => {
  const explanation = (!mistakeTags || mistakeTags.length === 0)
    ? `This trade has an acceptable risk score of ${riskScore}. No critical mistakes were detected.`
    : `This trade carries a risk score of ${riskScore} due to: ${mistakeTags.join(", ")}.`;

  return {
    explanation,
    behaviorAnalysis: "Standard trading behavior observed."
  };
};

const generateExplanation = async (riskScore, mistakeTags, context = {}) => {
  if (!process.env.GEMINI_API_KEY) {
    return generateDeterministicExplanation(riskScore, mistakeTags);
  }

  const { symbol, type, reason, userThinking } = context;

  const prompt = `You are a professional trading psychologist and risk analyst.
Context:
- Symbol: ${symbol}
- Trade Type: ${type}
- Risk Score: ${riskScore}/100
- Mistake Tags: ${mistakeTags.length > 0 ? mistakeTags.join(", ") : "None"}
- User's Stated Reason: ${reason || "Not provided"}
- User's Internal Thinking: ${userThinking || "Not provided"}

Produce a JSON response with two fields:
1. "explanation": A concise (2 sentences) explanation of the technical risk.
2. "behaviorAnalysis": A deep, empathetic analysis of the user's psychological state and decision-making logic. Identify if they are being impulsive, disciplined, fearful, or overly optimistic.

Rules:
- Be professional yet humanised.
- Use the User's Thinking to reveal hidden biases.
- Keep the tone constructive.
- Response MUST be valid JSON.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise
    ]);

    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (error) {
    const logger = require("../lib/logger");
    logger.error({ action: "AI_GENERATION_FAILED", error: error.message, model: "gemini-1.5-flash" });
    return generateDeterministicExplanation(riskScore, mistakeTags);
  }
};

const generateMarketInsight = async (symbol, technicals, newsItems) => {
  if (!process.env.GEMINI_API_KEY) {
    return {
      signal: "NEUTRAL",
      analysis: "AI Insight currently unavailable (API Key missing). Rely on technical indicators.",
      confidence: 50
    };
  }

  const prompt = `You are a Senior Quantitative Analyst at a top-tier hedge fund.
    Context:
    - Asset: ${symbol}
    - Technicals: RSI=${technicals.rsi}, Change=${technicals.change}%, Volume=${technicals.volume}
    - News Headlines: ${newsItems.map(n => n.title).join(" | ")}

    Analyze this data and produce a JSON response with:
    1. "signal": "STRONG BUY", "BUY", "NEUTRAL", "SELL", or "STRONG SELL"
    2. "analysis": A deep 3-sentence synthesis of how the news interacts with the price action.
    3. "confidence": A percentage score (0-100).
    4. "keyRisk": The single biggest risk factor right now.

    Rules:
    - Do not be generic. Mention specific headlines if relevant.
    - If news contradicts technicals, explain the divergence.
    - Response MUST be valid JSON.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return JSON.parse(response.text());
  } catch (error) {
    console.error("[AI Insight Error]", error);
    return {
      signal: "NEUTRAL",
      analysis: "Unable to synthesize AI narrative. Market volatility may be exceeding processing limits.",
      confidence: 0
    };
  }
};

const parseTradeIntent = async (rawIntent) => {
  if (!rawIntent || !process.env.GEMINI_API_KEY) {
    return { strategy: 'General', confidence: 50, keywords: [] };
  }

  const prompt = `You are a trading strategy classifier.
    User Intent: "${rawIntent}"

    Extract the following in JSON format:
    1. "strategy": Categorize into ONE: "BREAKOUT", "MEAN_REVERSION", "SCALPING", "TREND_FOLLOWING", "NEWS_PLAY", "VALUE_INVESTING", or "GENERAL".
    2. "confidence": Estimate user's confidence level (0-100) based on their wording.
    3. "keywords": List 3-5 key technical or emotional keywords.

    Response MUST be valid JSON.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return JSON.parse(response.text());
  } catch (error) {
    console.error("[Intent Parser Error]", error);
    return { strategy: 'General', confidence: 50, keywords: [] };
  }
};

const generateTradeReviewSummary = async (reviewData, tradeContext) => {
  if (!process.env.GEMINI_API_KEY) {
    return "Retrospective analysis currently being processed. Review technical audit for raw data.";
  }

  const { verdict, strategyDescription } = reviewData;
  const { symbol, pnl, missedOpportunity } = tradeContext;

  const prompt = `You are a Performance Coach for Institutional Traders.
    Symbol: ${symbol}
    Verdict: ${verdict}
    Strategy: ${strategyDescription}
    PnL: ₹${(pnl / 100).toFixed(2)}
    Missed Opp: ₹${((missedOpportunity?.maxPotentialProfit || 0) / 100).toFixed(2)}

    Write a 2-sentence 'Post-Mortem' summary.
    - If GOOD but Loss, praise the discipline.
    - If LUCK but Profit, warn about the hidden risk in strategy mismatch.
    - If POOR, be firm but constructive about the mistake.
    - Mention if they left significant money on the table.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    return `Trade classified as ${verdict}. Review strategy audit for deeper metrics.`;
  }
};

/**
 * HYBRID ENGINE: AI INTERPRETATION LAYER
 * Extracts sentiment with nuance, summarizes multiple signals, and provides reasoning.
 * AI MUST NOT output BUY/SELL.
 */
const interpretMarketSignal = async (headlines, context = {}) => {
  if (!process.env.GEMINI_API_KEY) {
    return {
      nuance: "Standard signal processing active.",
      sentimentScore: 0,
      reasoning: "AI Interpretation node on standby. Relying on deterministic baselines.",
      confidence: 50
    };
  }

  const prompt = `You are a Senior Macro Intelligence AI.
    Headlines: ${headlines.join(" | ")}
    Sector: ${context.sector || "General"}
    
    Task:
    1. Extract directional sentiment nuance (Why is this happening?).
    2. Quantify sentiment score (-10 to +10).
    3. Generate human-readable reasoning (2 sentences).
    4. Resolve any contradictions between headlines.
    
    Rules:
    - DO NOT output BUY or SELL.
    - Be objective and institutional.
    - Response MUST be valid JSON with fields: "nuance", "sentimentScore", "reasoning", "confidence".
    
    Format: JSON`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return JSON.parse(response.text());
  } catch (error) {
    console.error("[AI Interpretation Error]", error);
    return {
      nuance: "Nuance extraction failed.",
      sentimentScore: 0,
      reasoning: "Consensus engines maintaining rule-based baselines.",
      confidence: 40
    };
  }
};

/**
 * AI FINAL TRADE CALL
 * Synthesizes market context, setup, behavior, and risk into a definitive call.
 * RULES: Do NOT change final verdict.
 */
const generateFinalTradeCall = async (inputs, context = {}) => {
  if (!process.env.GEMINI_API_KEY) {
    return {
      finalCall: context.verdict || "WAIT",
      confidence: context.score || 50,
      reasoning: "Rule-based synthesis active. Awaiting AI node synchronization.",
      suggestedAction: context.verdict === "BUY" ? "Enter Position" : "Wait for Clarity"
    };
  }

  const { market, setup, behavior, risk, finalScore } = inputs;
  const verdict = context.verdict || "WAIT";

  const prompt = `You are a Chief Investment Officer.
    
    Market Context:
    - Direction: ${market.direction}, Confidence: ${market.confidence}%, Reason: ${market.reason}
    
    Trade Setup:
    - Type: ${setup.type}, Quality: ${setup.score}, Reason: ${setup.reason}
    
    Behavioral State:
    - Risk: ${behavior.risk}, Score: ${behavior.score}, Reason: ${behavior.reason}
    
    Risk Exposure:
    - Level: ${risk.level}, Score: ${risk.score}, Reason: ${risk.reason}
    
    Final Score: ${finalScore}
    Final Verdict: ${verdict}
    
    TASK:
    Generate a final trade decision explanation.
    
    RULES:
    - Do NOT change the final verdict (${verdict}).
    - Explain WHY the decision was reached.
    - Highlight conflicts (if any).
    - Keep explanation concise (3-5 lines).
    - Tone: Professional, analytical, decisive.
    
    OUTPUT FORMAT (JSON):
    {
      "reasoning": "A summary of key drivers across market, setup, behavior, and risk",
      "suggestedAction": "Enter / Wait / Reduce Size / Avoid",
      "confidence": ${finalScore}
    }`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());
    
    return {
      finalCall: verdict,
      confidence: data.confidence,
      reasoning: data.reasoning,
      suggestedAction: data.suggestedAction
    };
  } catch (error) {
    console.error("[AI Final Call Error]", error);
    return {
      finalCall: verdict,
      confidence: finalScore,
      reasoning: "Deterministic fallback active. Logic aligned with rule-based risk audit.",
      suggestedAction: "Follow Rule-based Protocol"
    };
  }
};

const summarizeMarketDrivers = async (headlines) => {
  if (!headlines || headlines.length === 0 || !process.env.GEMINI_API_KEY) {
    return ["General market movement observed."];
  }

  const prompt = `You are a financial news summarizer. 
  Headlines: ${headlines.join(" | ")}
  
  Extract the 3 most significant market themes/drivers from these headlines.
  Return ONE JSON array of strings, each string maximum 10 words.
  Response MUST be valid JSON array of strings.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("[AI Summary Error]", error);
    return headlines.slice(0, 3);
  }
};

module.exports = {
  generateExplanation,
  generateMarketInsight,
  parseTradeIntent,
  generateTradeReviewSummary,
  interpretMarketSignal,
  generateFinalTradeCall,
  summarizeMarketDrivers
};

