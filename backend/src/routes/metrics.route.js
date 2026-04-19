const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const Trade = require('../models/trade.model');
const { mapToClosedTrades } = require('../domain/closedTrade.mapper');
const { analyzeReflection } = require('../engines/reflection.engine');
const { analyzeBehavior } = require('../services/behavior.engine');
const { analyzeProgression } = require('../services/progression.engine');
const { calculateSkillScore } = require('../services/skill.engine');
const { normalizeTrade } = require('../domain/trade.contract');
const { sendSuccess } = require("../utils/response.helper");

/**
 * GET /api/metrics/skill-progress
 * Returns cumulative skill score progression for the last 50 closed trades.
 */
router.get('/skill-progress', authMiddleware, async (req, res, next) => {
  try {
    const rawTrades = await Trade.find({ user: req.user._id }).sort({ createdAt: 1 });
    const normalized = rawTrades.map(t => normalizeTrade(t));
    const allClosed = mapToClosedTrades(normalized);
    
    // Focus only on the most recent 50 trades for clarity
    const windowSize = 50;
    const startIndex = Math.max(0, allClosed.length - windowSize);
    const windowedClosed = allClosed.slice(startIndex);
    
    const progress = [];

    // For each trade in the window, calculate what the skill score was at that point in history
    for (let i = 0; i < windowedClosed.length; i++) {
       const cutoffIndex = startIndex + i + 1;
       const historicalSnapshot = allClosed.slice(0, cutoffIndex);
       
       const reflections = historicalSnapshot.map(ct => analyzeReflection(ct));
       const behavior = analyzeBehavior(historicalSnapshot);
       const progression = analyzeProgression(historicalSnapshot);
       const skill = calculateSkillScore(historicalSnapshot, reflections, behavior, progression);
       
       progress.push({
         tradeIndex: cutoffIndex,
         skillScore: skill.score,
         timestamp: windowedClosed[i].exitTime
       });
    }

    sendSuccess(res, req, {
      success: true,
      data: progress,
      meta: { totalClosed: allClosed.length, windowSize: windowedClosed.length }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/metrics/behavior
 * Returns a breakdown of psychological pattern counts.
 */
router.get('/behavior', authMiddleware, async (req, res, next) => {
  try {
    const rawTrades = await Trade.find({ user: req.user._id }).sort({ createdAt: 1 });
    const closed = mapToClosedTrades(rawTrades.map(t => normalizeTrade(t)));
    const behavior = analyzeBehavior(closed);
    
    const data = {
      revengeTrading: behavior.patterns.find(p => p.type === "REVENGE_TRADING")?.count || 0,
      overtrading: behavior.patterns.find(p => p.type === "OVERTRADING")?.count || 0,
      earlyExit: behavior.patterns.find(p => p.type === "EARLY_EXIT_PATTERN")?.count || 0,
      holdingLosers: behavior.patterns.find(p => p.type === "HOLDING_LOSERS")?.count || 0,
      disciplineScore: behavior.disciplineScore || 100
    };

    sendSuccess(res, req, { success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/metrics/outcomes
 * Returns counts of trades mapped to specific reflection verdicts.
 */
router.get('/outcomes', authMiddleware, async (req, res, next) => {
  try {
    // Rely exclusively on the deterministic outcomes stored in the reflection engine results
    const reflectionTrades = await Trade.find({ 
      user: req.user._id, 
      "learningOutcome.verdict": { $exists: true } 
    });

    const outcomes = {
      disciplinedProfit: 0,
      disciplinedLoss: 0,
      poorProcess: 0,
      luckyProfit: 0
    };

    reflectionTrades.forEach(t => {
      const v = t.learningOutcome.verdict;
      if (v === "DISCIPLINED_PROFIT") outcomes.disciplinedProfit++;
      else if (v === "DISCIPLINED_LOSS") outcomes.disciplinedLoss++;
      else if (v === "POOR_PROCESS") outcomes.poorProcess++;
      else if (v === "LUCKY_PROFIT") outcomes.luckyProfit++;
    });

    sendSuccess(res, req, { success: true, data: outcomes });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
