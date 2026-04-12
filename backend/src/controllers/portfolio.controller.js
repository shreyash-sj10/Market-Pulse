const User = require("../models/user.model");
const Trade = require("../models/trade.model");
const { getLivePrices } = require("../services/marketData.service");
const Decimal = require("decimal.js");
const { analyzeBehavior } = require("../services/behavior.engine");
const { analyzeProgression } = require("../services/progression.engine");
const { calculateSkillScore } = require("../services/skill.engine");
const AppError = require("../utils/AppError");
const { toSafeKey, fromSafeKey } = require("../utils/safeUtils");

const getPortfolioSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 1. Get Live Prices
    const holdingSymbols = Array.from(user.holdings.keys()).map(fromSafeKey);
    const livePrices = await getLivePrices(holdingSymbols);

    // 2. Compute MTM
    let unrealizedPnL = new Decimal(0);
    let currentEquityValue = new Decimal(0);

    user.holdings.forEach((data, safeSymbol) => {
      const symbol = fromSafeKey(safeSymbol);
      const livePrice = livePrices[symbol];
      const effectivePrice = livePrice !== undefined ? livePrice : data.avgCost;
      const marketValue = new Decimal(data.quantity).mul(effectivePrice);
      const costBasis = new Decimal(data.quantity).mul(data.avgCost);
      const gain = marketValue.sub(costBasis);
      unrealizedPnL = unrealizedPnL.add(gain);
      currentEquityValue = currentEquityValue.add(marketValue);
    });

    // 3. Aggregate Behavioral Insights
    const analysisTrades = await Trade.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(100);

    const sortedTrades = [...analysisTrades].sort((a, b) => a.createdAt - b.createdAt);
    const behavior = analyzeBehavior(sortedTrades);
    const progression = analyzeProgression(sortedTrades);
    const skillAudit = calculateSkillScore(sortedTrades, behavior, progression);

    const recentBehaviors = analysisTrades.slice(0, 5);

    // 4. Construct Response
    const response = {
      success: true,
      summary: {
        balance: user.balance,
        totalInvested: user.totalInvested || 0,
        realizedPnL: user.realizedPnL || 0,
        unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
        netEquity: Number(new Decimal(user.balance).add(currentEquityValue).toFixed(2)),
        winRate: await computeWinRate(userId),
        holdings: Object.fromEntries(
          Array.from(user.holdings.entries()).map(([k, v]) => [fromSafeKey(k), v])
        ),
        skillAudit,
        behaviorInsights: {
          success: behavior.success,
          patterns: behavior.patterns || [],
          dominantMistake: behavior.dominantMistake || "None",
          mistakeFrequency: behavior.mistakeFrequency || {},
          riskProfile: behavior.riskProfile,
          progression: progression.success ? progression.progression : null,
          recentBehaviors: recentBehaviors.map(t => ({
            symbol: t.symbol,
            type: t.type,
            behavior: t.analysis?.humanBehavior || "Analyzing...",
            timestamp: t.createdAt
          }))
        }
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Simple O(1) query for win rate counts.
 */
const computeWinRate = async (userId) => {
  const [sellTrades, winTrades] = await Promise.all([
    Trade.countDocuments({ user: userId, type: "SELL" }),
    Trade.countDocuments({ user: userId, type: "SELL", pnl: { $gt: 0 } })
  ]);

  if (sellTrades === 0) return 0;
  return Number(((winTrades / sellTrades) * 100).toFixed(2));
};

/**
 * GET /api/portfolio/positions
 * Fetches all user holdings with live valuation and unrealized P&L metrics.
 */
const getPositions = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const holdingSymbols = Array.from(user.holdings.keys()).map(fromSafeKey);
    if (holdingSymbols.length === 0) {
      return res.status(200).json({ success: true, positions: [] });
    }

    // Fetch live prices
    const livePrices = await getLivePrices(holdingSymbols);

    const positions = Array.from(user.holdings.entries()).map(([safeSymbol, data]) => {
      const symbol = fromSafeKey(safeSymbol);
      const livePrice = livePrices[symbol];

      // Fallback: Use avgCost as currentPrice if live fetch failed
      const currentPrice = livePrice !== undefined ? livePrice : data.avgCost;
      if (livePrice === undefined) {
        console.warn(`[POS_FALLBACK] Missing live price for ${symbol}`);
      }

      const investedValue = new Decimal(data.quantity).mul(data.avgCost).toNumber();
      const currentValue = new Decimal(data.quantity).mul(currentPrice).toNumber();
      const unrealizedPnL = new Decimal(currentValue).sub(investedValue).toNumber();

      return {
        symbol: symbol.split(".")[0],
        fullSymbol: symbol,
        quantity: data.quantity,
        avgPrice: Math.round(data.avgCost),
        currentPrice: Math.round(currentPrice),
        investedValuePaise: Math.round(investedValue),
        currentValuePaise: Math.round(currentValue),
        unrealizedPnL: Math.round(unrealizedPnL),
        pnlPercentage: investedValue > 0 ? Number(((unrealizedPnL / investedValue) * 100).toFixed(2)) : 0
      };
    });

    res.status(200).json({ success: true, positions });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPortfolioSummary, getPositions };

