const Trade = require("../models/trade.model");
const { analyzeBehavior } = require("../services/behavior.engine");
const { generateInsights } = require("../services/insight.engine");
const { analyzeProgression } = require("../services/progression.engine");
const Decimal = require("decimal.js");
const { normalizeTrade } = require("../domain/trade.contract");
const { mapToClosedTrades } = require("../domain/closedTrade.mapper");
const { ANALYTICS_SNAPSHOT_VALID_MS } = require("../constants/analyticsSnapshot.constants");
const { RECENT_TRADE_SNAPSHOT_BYPASS_MS } = require("../constants/systemConvergence.constants");
const { sendSuccess } = require("../utils/response.helper");

/**
 * GET /analysis/summary
 * Generates deterministic behavioral analysis by pairing historical orders into closed trades.
 */
const getAnalysisSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const User = require("../models/user.model");
    const user = await User.findById(userId).lean();

    // PHASE 3: Snapshot First (TTL aligned with portfolio + recent-trade bypass)
    const snapshotMs = user.analyticsSnapshot?.lastUpdated
      ? new Date(user.analyticsSnapshot.lastUpdated).getTime()
      : 0;
    const lastActMs = user.lastTradeActivityAt ? new Date(user.lastTradeActivityAt).getTime() : 0;
    const recentTradeWindow = lastActMs && Date.now() - lastActMs < RECENT_TRADE_SNAPSHOT_BYPASS_MS;
    const tradeNewerThanSnapshot = lastActMs && lastActMs > snapshotMs;
    const snapshotBypassed = Boolean(recentTradeWindow || tradeNewerThanSnapshot);
    const hasValidSnapshot =
      !snapshotBypassed &&
      user.analyticsSnapshot &&
      Date.now() - snapshotMs < ANALYTICS_SNAPSHOT_VALID_MS;
    
    if (hasValidSnapshot) {
      const logger = require("../utils/logger");
      logger.info("Deep analysis snapshot hit", { 
        action: "ANALYTICS_SNAPSHOT_HIT", 
        userId: user._id, 
        source: "SNAPSHOT" 
      });


      return sendSuccess(res, req, {
        success: true,
        data: {
          patterns: (user.analyticsSnapshot.tags || []).map((t) => ({
            type: t,
            confidence: null,
          })),
          disciplineScore: user.analyticsSnapshot.disciplineScore,
          progression: { trend: user.analyticsSnapshot.trend, narrative: "Recent sessions show consistent protocol adherence." }
        },
        meta: {
          source: "snapshot",
          timestamp: user.analyticsSnapshot.lastUpdated,
          analyticsSnapshotValidMs: ANALYTICS_SNAPSHOT_VALID_MS,
          systemStateVersion: user.systemStateVersion ?? 0,
          snapshotBypassed,
          snapshotBypassReason: snapshotBypassed
            ? recentTradeWindow
              ? "RECENT_TRADE_WINDOW"
              : "TRADE_AFTER_SNAPSHOT"
            : undefined,
        },
      });

    }

    // Fetch ALL trades for the user to perform high-fidelity pairing
    const rawTrades = await Trade.find({ user: userId }).sort({ createdAt: 1 }).lean();

    const normalizedTrades = rawTrades.map((trade) => normalizeTrade(trade));

    if (normalizedTrades.length < 10) {
      return sendSuccess(res, req, {
        success: false,
        error: "INSUFFICIENT_DATA",
        meta: { systemStateVersion: user.systemStateVersion ?? 0 },
      });
    }

    // 1. Pairing Engine (FIFO Algorithm)
    const closedTrades = mapToClosedTrades(normalizedTrades);

    // 2. Journal Intelligence Engine
    const { calculateJournalInsights } = require("../engines/journalInsights.engine");
    const journalInsights = calculateJournalInsights(closedTrades);

    // 3. Execute Deterministic Behavior Analysis
    const behaviorOutput = analyzeBehavior(closedTrades);

    if (!behaviorOutput.success) {
      return sendSuccess(res, req, {
        ...behaviorOutput,
        journalInsights
      });
    }

    // 4. Generate Human-Readable Insights
    const insights = generateInsights(behaviorOutput);

    // 5. Analyze User Progression (Recent vs Past)
    const progressionOutput = analyzeProgression(closedTrades);

    sendSuccess(res, req, {
      success: true,
      data: {
        ...behaviorOutput,
        ...insights,
        journalInsights,
        progression: progressionOutput.success ? progressionOutput.progression : { trend: "INSUFFICIENT_DATA", narrative: "Continue trading to unlock performance progression tracking." }
      },
      meta: {
        timestamp: new Date(),
        source: "compute",
        analyticsSnapshotValidMs: ANALYTICS_SNAPSHOT_VALID_MS,
        systemStateVersion: user.systemStateVersion ?? 0,
        snapshotBypassed,
      },
    });


  } catch (error) {
    next(error);
  }
};

module.exports = { getAnalysisSummary };
