const aiExtractor = require("./aiExtractor.service");
const newsEngine = require("../news/news.engine");
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * FINAL JUDGMENT ENGINE — TRADE EVALUATION INTELLIGENCE
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateJudgment = async (tradeRequest, user) => {
  const { symbol, side, price, quantity } = tradeRequest;
  
  // 1. Building Context
  const news = await newsEngine.getProcessedNews(symbol);
  const signals = news.news.slice(0, 8);
  
  // 2. Alignment & Risk Scoring (Deterministic)
  let trendAlignment = "NEUTRAL";
  let riskScore = 30;
  const keyPoints = [];
  const flags = [];

  const sentimentSum = signals.reduce((acc, s) => {
    if (s.sentiment === "BULLISH") acc++;
    if (s.sentiment === "BEARISH") acc--;
    return acc;
  }, 0);

  if (sentimentSum > 1) {
    trendAlignment = side === "BUY" ? "WITH_TREND" : "AGAINST_TREND";
    keyPoints.push(`Strong bullish sentiment detected in recent news (${sentimentSum} net signals)`);
  } else if (sentimentSum < -1) {
    trendAlignment = side === "BUY" ? "AGAINST_TREND" : "WITH_TREND";
    keyPoints.push(`Bearish pressure detected in recent signals (${Math.abs(sentimentSum)} negative signals)`);
  } else {
    trendAlignment = "NEUTRAL";
    keyPoints.push("Mixed or low-volume sentiment signals; trend clarity is low");
  }

  // 3. Behavioral Overlay
  const lastTrade = (user.trades || [])[0];
  if (lastTrade && lastTrade.profit < 0 && (Date.now() - new Date(lastTrade.timestamp).getTime()) < 3600000) {
    riskScore += 20;
    flags.push("REVENGE_TRADING_TRAP");
    keyPoints.push("Behavior Pulse: Rapid re-entry after loss may compromise objectivity");
  }

  if (trendAlignment === "AGAINST_TREND") {
    riskScore += 40;
    keyPoints.push(`Counter-trend execution: entering ${side} against negative sectoral velocity`);
  }

  // 4. AI Summarization (Optional)
  let summary = `This trade is ${trendAlignment.replace('_', ' ').toLowerCase()} driven by recent ${sentimentSum > 0 ? 'positive' : 'negative'} market transmissions.`;
  
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Act as a cynical financial auditor. Summarize this trade in one punchy sentence. 
        Symbol: ${symbol}, Intent: ${side}, News Sentiment Score: ${sentimentSum}, Risk Score: ${riskScore}, Behavioral Flags: ${flags.join(',')}.
        Output only the sentence.`;
      const aiResult = await model.generateContent(prompt);
      summary = aiResult.response.text();
    } catch (e) {
      console.warn("AI Summarization failed, falling back to deterministic.");
    }
  }

  return {
    alignment: trendAlignment,
    riskScore: Math.min(riskScore, 100),
    summary,
    keyPoints,
    flags
  };
};

module.exports = { generateJudgment };
