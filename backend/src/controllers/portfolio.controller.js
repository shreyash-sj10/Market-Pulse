const User = require("../models/user.model");
const Holding = require("../models/holding.model");
const Trade = require("../models/trade.model");
const { getLivePrices } = require("../services/marketData.service");
const Decimal = require("decimal.js");
const { analyzeBehavior } = require("../services/behavior.engine");
const { analyzeProgression } = require("../services/progression.engine");
const { calculateSkillScore } = require("../services/skill.engine");
const { normalizeTrade } = require("../domain/trade.contract");
const { mapToClosedTrades } = require("../domain/closedTrade.mapper");
const { analyzeReflection } = require("../engines/reflection.engine");
const {
  derivePortfolioPositionsState,
  derivePortfolioSummaryState,
} = require("../utils/systemState");
const { SYSTEM_STATE } = require("../constants/systemState");
const { adaptPortfolio, adaptPositions } = require("../adapters/portfolio.adapter");

// buildClosedTrades has been replaced by src/domain/closedTrade.mapper.js

const getPortfolioSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const holdingsDocs = await Holding.find({ userId });

    // 1. Get Live Prices
    const holdingSymbols = holdingsDocs.map((h) => h.symbol);
    const livePrices = await getLivePrices(holdingSymbols);

    // 2. Compute MTM
    let unrealizedPnL = new Decimal(0);
    let currentEquityValue = new Decimal(0);

    holdingsDocs.forEach((data) => {
      const symbol = data.symbol;
      const liveQuote = livePrices[symbol];
      const livePrice = liveQuote?.pricePaise;
      const effectivePrice = livePrice !== undefined ? livePrice : data.avgPricePaise;
      const marketValue = new Decimal(data.quantity).mul(effectivePrice);
      const costBasis = new Decimal(data.quantity).mul(data.avgPricePaise);
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
    const winRate = await computeWinRate(userId);

    const holdingsPositions = holdingsDocs.map((holding) => ({
      symbol: holding.symbol,
      quantity: Number(holding.quantity) || 0,
      avgPrice: Math.round(Number(holding.avgPricePaise) || 0),
      stopLossPaise: null,
      targetPricePaise: null,
    }));

    const summaryState = derivePortfolioSummaryState({
      holdingsCount: holdingsDocs.length,
      positions: holdingsDocs.map((data) => {
        const liveQuote = livePrices[data.symbol];
        const livePrice = liveQuote?.pricePaise;
        return {
          currentPricePaise: livePrice !== undefined ? livePrice : data.avgPricePaise,
          isFallback: livePrice === undefined || Boolean(liveQuote?.isFallback),
          investedValuePaise: Number(new Decimal(data.quantity).mul(data.avgPricePaise)),
          currentValuePaise: Number(new Decimal(data.quantity).mul(livePrice !== undefined ? livePrice : data.avgPricePaise)),
          unrealizedPnL: Number(new Decimal(data.quantity).mul(livePrice !== undefined ? livePrice : data.avgPricePaise).sub(new Decimal(data.quantity).mul(data.avgPricePaise))),
          pnlPct: 0,
        };
      }),
      summary: {
        realizedPnL: user.realizedPnL || 0,
        unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
        netEquity: Number(new Decimal(user.balance).add(currentEquityValue).toFixed(2)),
        winRate,
        skillAudit,
        behaviorInsights: behavior,
      },
    });

    const availableBalance = user.balance - (user.reservedBalancePaise || 0);

    const rawResponseData = {
      state: summaryState,
      balance: availableBalance,
      totalInvested: user.totalInvested || 0,
      realizedPnL: user.realizedPnL || 0,
      unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
      netEquity: Number(new Decimal(user.balance).add(currentEquityValue).toFixed(2)),
      winRate,
      holdings: holdingsPositions,
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
          type: t.type,
          behavior: t.reasoning || "Analyzing...",
          timestamp: t.createdAt
        }))
      }
    };

    const response = {
      success: true,
      state: summaryState,
      data: adaptPortfolio(rawResponseData),
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
    const holdingsDocs = await Holding.find({ userId });

    const holdingSymbols = holdingsDocs.map((holding) => holding.symbol);
    if (holdingSymbols.length === 0) {
      return res.status(200).json({ success: true, state: SYSTEM_STATE.EMPTY, data: [] });
    }

    // Fetch live prices
    const livePrices = await getLivePrices(holdingSymbols);

    const positions = holdingsDocs.map((data) => {
      const symbol = data.symbol;
      const liveQuote = livePrices[symbol];
      const livePrice = liveQuote?.pricePaise;

      // Fallback: Use avgCost as currentPrice if live fetch failed
      const currentPrice = livePrice !== undefined ? livePrice : data.avgPricePaise;
      if (livePrice === undefined) {
        console.warn(`[POS_FALLBACK] Missing live quote for ${symbol}`);
      }

      const investedValue = new Decimal(data.quantity).mul(data.avgPricePaise).toNumber();
      const currentValue = new Decimal(data.quantity).mul(currentPrice).toNumber();
      const unrealizedPnL = new Decimal(currentValue).sub(investedValue).toNumber();

      return {
        symbol: symbol.split(".")[0],
        fullSymbol: symbol,
        quantity: data.quantity,
        avgPricePaise: Math.round(data.avgPricePaise),
        currentPricePaise: Math.round(currentPrice),
        source: liveQuote?.source || "FALLBACK",
        isFallback: liveQuote ? Boolean(liveQuote.isFallback) : true,
        investedValuePaise: Math.round(investedValue),
        currentValuePaise: Math.round(currentValue),
        unrealizedPnL: Math.round(unrealizedPnL),
        pnlPct: investedValue > 0 ? Number(((unrealizedPnL / investedValue) * 100).toFixed(2)) : 0
      };
    });

    const state = derivePortfolioPositionsState({
      holdingsCount: holdingsDocs.length,
      positions,
    });

    res.status(200).json({ success: true, state, data: adaptPositions(positions) });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPortfolioSummary, getPositions };
