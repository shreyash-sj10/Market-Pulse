const aiExtractor = require("./aiExtractor.service");
const newsEngine = require("../news/news.engine");
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * POST-TRADE REFLECTION ENGINE — BEHAVIOR + DECISION ANALYSIS
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateReflection = async (trade, closeRequest) => {
  const { symbol, entryPrice, quantity, side, analysis, createdAt } = trade;
  const exitPrice = closeRequest.price || trade.currentPrice;
  const exitTime = new Date();
  const entryTime = new Date(createdAt);

  // 1. Outcome Analysis
  const pnl = (exitPrice - entryPrice) * quantity;
  const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;
  const durationMinutes = Math.round((exitTime - entryTime) / 60000);
  const outcome = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "NEUTRAL";

  // 2. Expectation vs Reality
  const intent = analysis?.rawIntent || "No stated intent";
  const movementReal = exitPrice > entryPrice ? "UPWARD" : "DOWNWARD";
  const expectationsMet = (side === "BUY" && movementReal === "UPWARD") || (side === "SELL" && movementReal === "DOWNWARD");

  // 3. Signal Alignment Check
  const news = await newsEngine.getProcessedNews(symbol);
  const signals = news.signals || [];
  const entrySignals = signals.filter(s => new Date(s.time) <= entryTime).slice(0, 5);
  const exitSignals = signals.filter(s => new Date(s.time) > entryTime).slice(0, 5);

  const netEntrySentiment = entrySignals.reduce((acc, s) => acc + (s.sentiment === "BULLISH" ? 1 : -1), 0);
  const alignedAtEntry = (side === "BUY" && netEntrySentiment > 0) || (side === "SELL" && netEntrySentiment < 0);

  // 4. Behavioral Pattern Detection
  const behavioralFlags = [];
  const keyObservations = [];
  const learningTags = [];

  if (durationMinutes < 5 && Math.abs(pnlPct) < 0.5) {
    behavioralFlags.push("PANIC_EXIT_SIGNAL");
    learningTags.push("Premature Exit");
    keyObservations.push("Trade closed prematurely within 5 mins without significant price deviation");
  }

  if (!alignedAtEntry) {
    behavioralFlags.push("TREND_DISSOLUTION");
    learningTags.push("Trend Ignored");
    keyObservations.push(`Entry ${side} contradicted prevailing ${netEntrySentiment > 0 ? 'bullish' : 'bearish'} sentiment signals`);
  }

  if (outcome === "LOSS") {
    keyObservations.push(`Realized ${pnlPct.toFixed(2)}% loss over ${durationMinutes}m duration`);
  }

  // 5. AI Reflection Summary
  let insightSummary = `Trade was ${alignedAtEntry ? 'aligned' : 'unaligned'} with entry signals. Exited with a ${outcome.toLowerCase()} outcome.`;

  if (process.env.GEMINI_API_KEY) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Act as a professional trading mentor. Analyze this closed trade and provide one analytical, non-judgmental insight sentence.
        Intent: ${intent}, Outcome: ${outcome}, Aligned at Entry: ${alignedAtEntry}, Duration: ${durationMinutes}m, PnL: ${pnlPct.toFixed(2)}%.
        Output only the sentence.`;
      const aiResult = await model.generateContent(prompt);
      insightSummary = aiResult.response.text();
    } catch (e) {
      console.warn("AI Reflection failed.");
    }
  }

  return {
    id: `ref-${Date.now()}`,
    tradeId: trade.id || trade._id,
    outcome,
    alignment: alignedAtEntry ? "WITH_TREND" : "AGAINST_TREND",
    pnl: pnlPct.toFixed(2),
    duration: durationMinutes,
    keyObservations,
    behavioralFlags,
    learningTags,
    insightSummary
  };
};

module.exports = { generateReflection };
