const Trade = require("../models/trade.model");
const { mapToClosedTrades } = require("../domain/closedTrade.mapper");
const { normalizeTrade } = require("../domain/trade.contract");
const { deriveReflectionState } = require("../utils/systemState");
const { adaptJournal } = require("../adapters/journal.adapter");
const { analyzeReflection } = require("../engines/reflection.engine");
const logger = require("../utils/logger");

/**
 * GET /api/journal/summary
 * Thinking-first journal aggregator.
 */
exports.getJournalSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const trades = await Trade.find({ user: userId }).sort({ createdAt: 1 });
    const normalized = trades.map((t) => normalizeTrade(t));
    let closed;
    try {
      closed = mapToClosedTrades(normalized);
    } catch (e) {
      logger.error({ action: "JOURNAL_FIFO_FAILED", userId, message: e?.message || String(e) });
      return res.status(200).json({
        success: true,
        state: deriveReflectionState({ closedTrades: [], reflections: [] }),
        data: { totalClosed: 0, frequentPatterns: [], entries: [] },
        meta: { journalWarning: "TRADE_HISTORY_COULD_NOT_BE_PAIRED" },
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
        tags: reflection.tags || []
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

    res.status(200).json({
      success: true,
      state,
      data: {
        totalClosed: cards.length,
        frequentPatterns,
        entries: cards.map((c) => ({
            tradeId: c.tradeId,
            symbol: c.symbol,
            side: "SELL",
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
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};
