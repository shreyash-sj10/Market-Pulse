const Trade = require("../models/trade.model");
const { analyzeBehavior } = require("../services/behavior.engine");
const { generateInsights } = require("../services/insight.engine");
const { analyzeProgression } = require("../services/progression.engine");
const Decimal = require("decimal.js");

/**
 * GET /analysis/summary
 * Generates deterministic behavioral analysis by pairing historical orders into closed trades.
 */
const getAnalysisSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Fetch ALL trades for the user to perform high-fidelity pairing
    const rawTrades = await Trade.find({ user: userId }).sort({ createdAt: 1 });

    if (rawTrades.length < 10) {
      return res.status(200).json({ success: false, error: "INSUFFICIENT_DATA" });
    }

    // 1. Pairing Engine (FIFO Algorithm)
    // Turns raw order stream into the "Closed Trades" required by behavior.engine.js
    const closedTrades = [];
    const holdingsPool = {}; // Map of symbol -> Array of { quantity, price, createdAt, riskScore }

    rawTrades.forEach(trade => {
      const symbol = trade.symbol;
      if (trade.type === "BUY") {
        if (!holdingsPool[symbol]) holdingsPool[symbol] = [];
        holdingsPool[symbol].push({
          quantity: trade.quantity,
          price: trade.price,
          createdAt: trade.createdAt,
          riskScore: trade.analysis?.riskScore || 50
        });
      } else if (trade.type === "SELL") {
        let sellQty = trade.quantity;
        const buyStack = holdingsPool[symbol] || [];

        while (sellQty > 0 && buyStack.length > 0) {
          const firstBuy = buyStack[0];
          const matchedQty = Math.min(sellQty, firstBuy.quantity);

          // Calculate P&L for this segment
          const entryVal = new Decimal(matchedQty).mul(firstBuy.price);
          const exitVal = new Decimal(matchedQty).mul(trade.price);
          const pnl = exitVal.sub(entryVal).toNumber();
          const profitPct = (trade.price - firstBuy.price) / firstBuy.price;

          closedTrades.push({
            symbol,
            entryPrice: firstBuy.price,
            exitPrice: trade.price,
            quantity: matchedQty,
            createdAt: firstBuy.createdAt,
            closedAt: trade.createdAt, // Order timestamp as closure time
            riskScore: (firstBuy.riskScore + (trade.analysis?.riskScore || 50)) / 2,
            pnl,
            profitPct
          });

          sellQty -= matchedQty;
          firstBuy.quantity -= matchedQty;

          if (firstBuy.quantity === 0) {
            buyStack.shift();
          }
        }
      }
    });

    // 2. Execute Deterministic Behavior Analysis
    const behaviorOutput = analyzeBehavior(closedTrades);

    if (!behaviorOutput.success) {
      return res.status(200).json(behaviorOutput);
    }

    // 3. Generate Human-Readable Insights
    const insights = generateInsights(behaviorOutput);

    // 4. Analyze User Progression (Recent vs Past)
    const progressionOutput = analyzeProgression(closedTrades);

    res.status(200).json({
      ...behaviorOutput,
      ...insights,
      progression: progressionOutput.success ? progressionOutput.progression : { trend: "INSUFFICIENT_DATA", narrative: "Continue trading to unlock performance progression tracking." }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAnalysisSummary };
