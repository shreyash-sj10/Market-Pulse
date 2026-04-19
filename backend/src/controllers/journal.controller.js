const Trade = require("../models/trade.model");
const { mapToClosedTrades } = require("../domain/closedTrade.mapper");
const { normalizeTrade } = require("../domain/trade.contract");
const { deriveReflectionState } = require("../utils/systemState");
const { adaptJournal } = require("../adapters/journal.adapter");
const { analyzeReflection } = require("../engines/reflection.engine");
const logger = require("../utils/logger");
const { sendSuccess } = require("../utils/response.helper");

/**
 * GET /api/journal/summary
 * Thinking-first journal aggregator.
 */
exports.getJournalSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    // H-06 FIX: Add a hard limit to prevent O(n) full-collection scans for active
    // users. 500 trades covers all realistic journal use-cases while bounding
    // memory and response time. Sort ascending so FIFO pairing (BUY→SELL) works
    // correctly on the most recent window.
    const [trades, pendingRows, entryBuyTrades] = await Promise.all([
      Trade.find({ user: userId }).sort({ createdAt: 1 }).limit(500).lean(),
      Trade.find({
        user: userId,
        status: "PENDING_EXECUTION",
      })
        .sort({ createdAt: -1 })
        .select(
          "symbol type quantity pricePaise totalValuePaise status createdAt _id reason userThinking manualTags preTradeEmotion",
        )
        .lean(),
      Trade.find({
        user: userId,
        type: "BUY",
        status: { $in: ["EXECUTED", "EXECUTED_PENDING_REFLECTION", "COMPLETE", "PENDING_EXECUTION"] },
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .select(
          "symbol quantity pricePaise stopLossPaise targetPricePaise userThinking preTradeEmotion decisionSnapshot createdAt status executionTime _id",
        )
        .lean(),
    ]);

    const entryLogs = entryBuyTrades.map((t) => ({
      tradeId: String(t._id),
      kind: "ENTRY_OPEN",
      symbol: t.symbol,
      quantity: t.quantity,
      entryPricePaise: t.pricePaise,
      stopLossPaise: t.stopLossPaise ?? null,
      targetPricePaise: t.targetPricePaise ?? null,
      thesis: (t.userThinking || "").trim() || null,
      signalVerdict: t.decisionSnapshot?.pillars?.engine?.action ?? t.decisionSnapshot?.verdict ?? null,
      signalScore: t.decisionSnapshot?.score ?? null,
      preTradeEmotion: t.preTradeEmotion ?? null,
      openedAt: t.executionTime || t.createdAt,
      executionStatus: t.status,
    }));
    const normalized = trades.map((t) => normalizeTrade(t));
    let closed;
    try {
      closed = mapToClosedTrades(normalized);
    } catch (e) {
      logger.error({ action: "JOURNAL_FIFO_FAILED", userId, message: e?.message || String(e) });
      return sendSuccess(res, req, {
        success: true,
        state: deriveReflectionState({ closedTrades: [], reflections: [] }),
        data: { totalClosed: 0, frequentPatterns: [], entries: [], pendingExecutions: [], entryLogs },
        meta: {
          journalWarning: "TRADE_HISTORY_COULD_NOT_BE_PAIRED",
          journalScope: "CLOSED_ROUND_TRIPS_PLUS_ENTRY_LOGS",
          pendingExecutionCount: 0,
          entryLogCount: entryLogs.length,
          systemStateVersion: req.user?.systemStateVersion ?? 0,
        },
      });
    }

    const reflections = closed.map((ct) => {
      try {
        return analyzeReflection(ct);
      } catch (e) {
        logger.warn({ action: "JOURNAL_REFLECTION_SKIP", userId, symbol: ct.symbol, message: e?.message });
        return {
          verdict: "NEUTRAL",
          executionPattern: "MANUAL_EXIT",
          deviationScore: 50,
          insight: "Reflection engine skipped this row.",
          improvement: "Verify entry/exit prices in trade history.",
          tags: [],
        };
      }
    });
    const state = deriveReflectionState({ closedTrades: closed, reflections });

    // 1. Structured Trade Cards (Plan vs Actual)
    const cards = closed.map((ct, index) => {
      const reflection = reflections[index];
      return {
        tradeId: ct.exitTradeId,
        quantity: ct.quantity,
        exitPricePaise: ct.exitPricePaise,
        entryPricePaise: ct.entryPricePaise,
        symbol: ct.symbol,
        outcome: reflection.verdict,
        pnlPaise: ct.pnlPaise,
        pnlPct: ct.pnlPct,
        openedAt: ct.entryTime,
        closedAt: ct.exitTime,
        plan: {
          entryPaise: ct.entryPricePaise,
          slPaise: ct.stopLossPaise || ct.entryPlan?.stopLossPaise,
          targetPaise: ct.targetPricePaise || ct.entryPlan?.targetPricePaise,
          rr: ct.rr || ct.entryPlan?.rr
        },
        actual: {
          entryPaise: ct.entryPricePaise,
          exitPaise: ct.exitPricePaise
        },
        insight: {
          what: reflection.executionPattern,
          why: reflection.insight,
          improvement: reflection.improvement
        },
        tags: reflection.tags || [],
        preTradeEmotionAtEntry: ct.entryPreTradeEmotion ?? null,
      };
    }).reverse(); // Most recent first

    // 2. Pattern Summary
    const patterns = {};
    cards.forEach((c) => {
      (Array.isArray(c.tags) ? c.tags : []).forEach((t) => {
        patterns[t] = (patterns[t] || 0) + 1;
      });
    });

    const frequentPatterns = Object.entries(patterns)
      .map(([type, count]) => ({ type, count, frequency: Number((count / (cards.length || 1) * 100).toFixed(0)) }))
      .sort((a, b) => b.count - a.count);

    const pendingExecutions = pendingRows.map((t) => ({
      tradeId: String(t._id),
      symbol: t.symbol,
      side: t.type,
      quantity: t.quantity,
      pricePaise: t.pricePaise,
      totalValuePaise: t.totalValuePaise,
      status: t.status,
      createdAt: t.createdAt,
      reasoning:
        (t.preTradeEmotion ? `[${t.preTradeEmotion}] ` : "") + (t.userThinking || t.reason || ""),
      tags: Array.isArray(t.manualTags) ? t.manualTags : [],
    }));

    sendSuccess(res, req, {
      success: true,
      state,
      data: {
        totalClosed: cards.length,
        frequentPatterns,
        entries: cards.map((c) => ({
            tradeId: c.tradeId,
            symbol: c.symbol,
            // H-08 FIX: Journal entries represent closed round-trips (BUY+SELL pairs).
            // Previously hardcoded to "SELL" which was misleading. Use ROUND_TRIP to
            // accurately describe the entry type.
            side: "ROUND_TRIP",
            quantity: c.quantity,
            exitPricePaise: c.exitPricePaise,
            entryPricePaise: c.entryPricePaise,
            pnlPaise: c.pnlPaise,
            pnlPct: c.pnlPct,
            openedAt: c.openedAt,
            closedAt: c.closedAt,
            plan: c.plan,
            actual: c.actual,
            learningSurface: adaptJournal(c),
            preTradeEmotionAtEntry: c.preTradeEmotionAtEntry ?? null,
        })),
        pendingExecutions,
        entryLogs,
      },
      meta: {
        journalScope: "CLOSED_ROUND_TRIPS_PLUS_ENTRY_LOGS",
        closedEntryCount: cards.length,
        pendingExecutionCount: pendingExecutions.length,
        entryLogCount: entryLogs.length,
        /** Oldest→newest FIFO window used for pairing (H-06). */
        journalTradeLimit: 500,
        pipelineNote:
          "entries are closed BUY+SELL pairs; entryLogs are open/executed buy legs; pendingExecutions lists orders not yet executed into holdings.",
        systemStateVersion: req.user?.systemStateVersion ?? 0,
      },
    });
  } catch (error) {
    next(error);
  }
};
