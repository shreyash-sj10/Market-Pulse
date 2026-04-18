const Trade = require("../models/trade.model");
const { analyzeBehavior } = require("../services/behavior.engine");
const { generateInsights } = require("../services/insight.engine");
const { analyzeProgression } = require("../services/progression.engine");
const Decimal = require("decimal.js");
const { normalizeTrade } = require("../domain/trade.contract");
const { mapToClosedTrades } = require("../domain/closedTrade.mapper");


/**
 * GET /analysis/summary
 * Generates deterministic behavioral analysis by pairing historical orders into closed trades.
 */
const getAnalysisSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const User = require("../models/user.model");
    const user = await User.findById(userId);

    
    // PHASE 3: Snapshot First
    const SNAPSHOT_VALID_WINDOW = 12 * 60 * 60 * 1000;
    const hasValidSnapshot = user.analyticsSnapshot && (Date.now() - new Date(user.analyticsSnapshot.lastUpdated).getTime() < SNAPSHOT_VALID_WINDOW);
    
    if (hasValidSnapshot) {
      const logger = require("../utils/logger");
      logger.info("Deep analysis snapshot hit", { 
        action: "ANALYTICS_SNAPSHOT_HIT", 
        userId: user._id, 
        source: "SNAPSHOT" 
      });


      return res.status(200).json({
        success: true,
        data: {
          patterns: user.analyticsSnapshot.tags.map(t => ({ type: t, confidence: 100 })),
          disciplineScore: user.analyticsSnapshot.disciplineScore,
          progression: { trend: user.analyticsSnapshot.trend, narrative: "Recent sessions show consistent protocol adherence." }
        },
        meta: { source: "snapshot", timestamp: user.analyticsSnapshot.lastUpdated }
      });

    }

    // Fetch ALL trades for the user to perform high-fidelity pairing
    const rawTrades = await Trade.find({ user: userId }).sort({ createdAt: 1 });

    const normalizedTrades = rawTrades.map((trade) => normalizeTrade(trade));

    if (normalizedTrades.length < 10) {
      return res.status(200).json({ success: false, error: "INSUFFICIENT_DATA" });
    }

    // 1. Pairing Engine (FIFO Algorithm)
    const closedTrades = mapToClosedTrades(normalizedTrades);

    // 2. Journal Intelligence Engine
    const { calculateJournalInsights } = require("../engines/journalInsights.engine");
    const journalInsights = calculateJournalInsights(closedTrades);

    // 3. Execute Deterministic Behavior Analysis
    const behaviorOutput = analyzeBehavior(closedTrades);

    if (!behaviorOutput.success) {
      return res.status(200).json({
        ...behaviorOutput,
        journalInsights
      });
    }

    // 4. Generate Human-Readable Insights
    const insights = generateInsights(behaviorOutput);

    // 5. Analyze User Progression (Recent vs Past)
    const progressionOutput = analyzeProgression(closedTrades);

    res.status(200).json({
      success: true,
      data: {
        ...behaviorOutput,
        ...insights,
        journalInsights,
        progression: progressionOutput.success ? progressionOutput.progression : { trend: "INSUFFICIENT_DATA", narrative: "Continue trading to unlock performance progression tracking." }
      },
      meta: { timestamp: new Date(), source: "compute" }
    });


  } catch (error) {
    next(error);
  }
};

module.exports = { getAnalysisSummary };
