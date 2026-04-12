const User = require("../models/user.model");
const Trade = require("../models/trade.model");
const { getLivePrices } = require("../services/marketData.service");
const Decimal = require("decimal.js");
const { analyzeBehavior } = require("../services/behavior.engine");
const { analyzeProgression } = require("../services/progression.engine");
const { calculateSkillScore } = require("../services/skill.engine");
const { normalizeTrade } = require("../domain/trade.contract");
const { fromSafeKey } = require("../utils/safeUtils");
const { toHoldingsArray, toHoldingsObject } = require("../utils/holdingsNormalizer");
const { mapToClosedTrades } = require("../domain/closedTrade.mapper");
const { analyzeReflection } = require("../engines/reflection.engine");

// buildClosedTrades has been replaced by src/domain/closedTrade.mapper.js

const getPortfolioSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const holdingsObject = toHoldingsObject(user.holdings);

    // 1. Get Live Prices
    const holdingSymbols = Object.keys(holdingsObject).map(fromSafeKey);
    const livePrices = await getLivePrices(holdingSymbols);

    // 2. Compute MTM
    let unrealizedPnL = new Decimal(0);
    let currentEquityValue = new Decimal(0);

    Object.entries(holdingsObject).forEach(([safeSymbol, data]) => {
      const symbol = fromSafeKey(safeSymbol);
      const livePrice = livePrices[symbol];
      const effectivePrice = livePrice !== undefined ? livePrice : data.avgCost;
      const marketValue = new Decimal(data.quantity).mul(effectivePrice);
      const costBasis = new Decimal(data.quantity).mul(data.avgCost);
      const gain = marketValue.sub(costBasis);
      unrealizedPnL = unrealizedPnL.add(gain);
      currentEquityValue = currentEquityValue.add(marketValue);
    });

    // 3. Aggregate Behavioral Insights (PHASE 3: Snapshot First)
    let behavior, progression, skillAudit;
    const SNAPSHOT_VALID_WINDOW = 24 * 60 * 60 * 1000;
    const hasValidSnapshot = user.analyticsSnapshot && (Date.now() - new Date(user.analyticsSnapshot.lastUpdated).getTime() < SNAPSHOT_VALID_WINDOW);
    
    let recentBehaviors = [];
    let journalInsights = { topMistake: "NONE", frequency: 0, last10Summary: { winRate: 0, avgPnL: 0 }, timePatterns: "INSUFFICIENT_DATA", disciplineTrend: "STABLE" };

    if (hasValidSnapshot) {
       const logger = require("../lib/logger");
       logger.info("Portfolio snapshot analysis fulfilled from cache", { 
         action: "PORTFOLIO_SNAPSHOT_HIT", 
         userId: user._id, 
         source: "SNAPSHOT" 
       });


       skillAudit = {
         score: user.analyticsSnapshot.skillScore,
         trend: user.analyticsSnapshot.trend,
         breakdown: { discipline: user.analyticsSnapshot.disciplineScore }
       };
       behavior = { success: true, patterns: user.analyticsSnapshot.tags.map(t => ({ type: t, confidence: 100 })), disciplineScore: user.analyticsSnapshot.disciplineScore };
       progression = { success: true, trend: user.analyticsSnapshot.trend, changes: [], narrative: "Performance snapshot active." };

       journalInsights = user.analyticsSnapshot.journalInsights || journalInsights;
       
       const top5 = await Trade.find({ user: userId }).sort({ createdAt: -1 }).limit(5);
       recentBehaviors = top5.map(t => normalizeTrade(t));
    } else {
       const analysisTrades = await Trade.find({ user: userId }).sort({ createdAt: -1 }).limit(100);
       const normalizedTrades = analysisTrades.map((trade) => normalizeTrade(trade));
       const closedTrades = mapToClosedTrades(normalizedTrades);
       const reflectionResults = closedTrades.map(ct => analyzeReflection(ct));
       behavior = analyzeBehavior(closedTrades);
       progression = analyzeProgression(closedTrades);
       skillAudit = calculateSkillScore(closedTrades, reflectionResults, behavior, progression);
       
       const { calculateJournalInsights } = require("../engines/journalInsights.engine");
       journalInsights = calculateJournalInsights(closedTrades);
       recentBehaviors = normalizedTrades.slice(0, 5);
       
       const logger = require("../lib/logger");
       logger.info("Live portfolio analytics recalibration complete", {
          action: "PORTFOLIO_COMPUTE",
          userId: user._id,
          tradeCount: analysisTrades.length
       });
    }




    // 4. Construct Response (STRICT CONTRACT)
    const response = {
      success: true,
      data: {
        balance: user.balance,
        totalInvested: user.totalInvested || 0,
        realizedPnL: user.realizedPnL || 0,
        unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
        netEquity: Number(new Decimal(user.balance).add(currentEquityValue).toFixed(2)),
        winRate: await computeWinRate(userId),
        holdings: toHoldingsArray(holdingsObject),
        skillAudit,
        behaviorInsights: {
          success: behavior.success,
          patterns: behavior.patterns || [],
          dominantMistake: behavior.dominantMistake || "None",
          mistakeFrequency: behavior.mistakeFrequency || {},
          journalInsights: { ...journalInsights, ...user.analyticsSnapshot?.journalInsights },

          riskProfile: behavior.riskProfile,
          progression: progression.success ? progression : null,


          recentBehaviors: recentBehaviors.map(t => ({
            symbol: t.symbol,
            side: t.side,
            behavior: t.reasoning || "Analyzing...",
            timestamp: t.createdAt
          }))
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: "3.1.1-fixed-contract"
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
    Trade.countDocuments({ user: userId, type: "SELL", pnlPaise: { $gt: 0 } })
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
    const holdingsObject = toHoldingsObject(user.holdings);

    const holdingSymbols = Object.keys(holdingsObject).map(fromSafeKey);
    if (holdingSymbols.length === 0) {
      return res.status(200).json({ success: true, positions: [] });
    }

    // Fetch live prices
    const livePrices = await getLivePrices(holdingSymbols);

    const positions = Object.entries(holdingsObject).map(([safeSymbol, data]) => {
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
        avgPricePaise: Math.round(data.avgCost),
        currentPricePaise: Math.round(currentPrice),
        investedValuePaise: Math.round(investedValue),
        currentValuePaise: Math.round(currentValue),
        unrealizedPnL: Math.round(unrealizedPnL),
        pnlPct: investedValue > 0 ? Number(((unrealizedPnL / investedValue) * 100).toFixed(2)) : 0
      };
    });

    res.status(200).json({ success: true, positions });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPortfolioSummary, getPositions };
