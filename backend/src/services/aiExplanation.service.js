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

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("AI timeout")), 10000);
    });

    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise,
    ]);

    const response = await result.response;
    const data = JSON.parse(response.text());

    return {
      explanation: data.explanation,
      behaviorAnalysis: data.behaviorAnalysis
    };
  } catch (error) {
    console.error("[AI Service Error]", error);
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

module.exports = {
  generateExplanation,
  generateMarketInsight,
  parseTradeIntent,
  generateTradeReviewSummary
};
