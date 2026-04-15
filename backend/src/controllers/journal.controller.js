const Trade = require("../models/trade.model");
const { mapToClosedTrades } = require("../domain/closedTrade.mapper");
const { normalizeTrade } = require("../domain/trade.contract");
const { deriveReflectionState } = require("../utils/systemState");
const { adaptJournal } = require("../adapters/journal.adapter");
const { analyzeReflection } = require("../engines/reflection.engine");

/**
 * GET /api/journal/summary
 * Thinking-first journal aggregator.
 */
exports.getJournalSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const trades = await Trade.find({ user: userId }).sort({ createdAt: 1 });
    const normalized = trades.map(t => normalizeTrade(t));
    const closed = mapToClosedTrades(normalized);

    const reflections = closed.map((ct) => analyzeReflection(ct));
    const state = deriveReflectionState({ closedTrades: closed, reflections });

    // 1. Structured Trade Cards (Plan vs Actual)
    const cards = closed.map((ct, index) => {
      const reflection = reflections[index];
      return {
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
    cards.forEach(c => {
      c.tags.forEach(t => {
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
        entries: cards.map(c => ({
            symbol: c.symbol,
            pnlPaise: c.pnlPaise,
            pnlPct: c.pnlPct,
            openedAt: c.openedAt,
            closedAt: c.closedAt,
            plan: c.plan,
            actual: c.actual,
            learningSurface: adaptJournal(c)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};
