/**
 * BEHAVIOR ENGINE (FIXED)
 * Strictly consumes ClosedTrade objects to detect psychological failure patterns.
 */
const { SYSTEM_CONFIG } = require("../config/system.config");
const {
  createUnavailableStatus,
  createValidStatus,
} = require("../constants/intelligenceStatus");

const analyzeBehavior = (closedTrades) => {
  const cfg = SYSTEM_CONFIG.behavior;
  if (!closedTrades || !Array.isArray(closedTrades) || closedTrades.length === 0) {
    return {
      ...createUnavailableStatus("INSUFFICIENT_BEHAVIOR_DATA"),
      success: false,
      patterns: [],
      dominantMistake: null,
      disciplineScore: null
    };
  }

  // Ensure chronological order by exit time for consistent pattern detection
  const validClosedTrades = closedTrades.filter(t => t && t.exitTime && t.entryTime);
  const sorted = [...validClosedTrades].sort((a, b) => a.exitTime - b.exitTime);
  
  if (sorted.length === 0) {
     return {
       ...createUnavailableStatus("INSUFFICIENT_BEHAVIOR_DATA"),
       success: false,
       patterns: [],
       dominantMistake: null,
       disciplineScore: null,
     };
  }

  const patterns = [];

  // 1. REVENGE TRADING
  // Rule: New trade entry within 60 minutes after a realized loss.
  let revengeCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.pnlPaise < 0) {
      const timeGapMin = (curr.entryTime - prev.exitTime) / (1000 * 60);
      if (timeGapMin > 0 && timeGapMin < cfg.revengeWindowMinutes) {
        revengeCount++;
      }
    }
  }
  if (revengeCount > 0) {
    patterns.push({ 
      type: "REVENGE_TRADING", 
      confidence: Math.min(100, (revengeCount / sorted.length) * cfg.revengeConfidenceScale), 
      count: revengeCount 
    });
  }

  // 2. OVERTRADING
  // Rule: Execution frequency > 5 trades per day.
  const firstTime = sorted[0].entryTime;
  const lastTime = sorted[sorted.length - 1].exitTime;
  const totalDays = Math.max(1, (lastTime - firstTime) / (1000 * 60 * 60 * 24));
  const tradesPerDay = sorted.length / totalDays;
  if (tradesPerDay > cfg.overtradingPerDayLimit) {
    patterns.push({ 
      type: "OVERTRADING", 
      confidence: Math.min(100, (tradesPerDay / cfg.overtradingPerDayLimit) * cfg.overtradingConfidenceScale), 
      count: Math.round(tradesPerDay) 
    });
  }

  // 3. EARLY EXIT PATTERN
  // Rule: Repeated deviation from target in profitable trades.
  const earlyExits = sorted.filter(t => 
    t.behaviorTags?.includes("EARLY_EXIT") || 
    t.decisionSnapshot?.exit?.executionPattern === "EARLY_EXIT"
  ).length;
  if (earlyExits > 0) {
    patterns.push({ 
      type: "EARLY_EXIT_PATTERN", 
      confidence: Math.min(100, (earlyExits / sorted.length) * cfg.earlyExitConfidenceScale), 
      count: earlyExits 
    });
  }

  // 4. HOLDING LOSERS
  // Rule: Average hold time for losses > 1.5x average hold time for wins.
  const losses = sorted.filter(t => t.pnlPaise < 0);
  const wins = sorted.filter(t => t.pnlPaise > 0);
  const avgLossHold = losses.reduce((acc, t) => acc + t.holdTime, 0) / (losses.length || 1);
  const avgWinHold = wins.reduce((acc, t) => acc + t.holdTime, 0) / (wins.length || 1);
  if (avgLossHold > avgWinHold * cfg.holdingLosersMultiplier && losses.length > 0) {
    patterns.push({ 
      type: "HOLDING_LOSERS", 
      confidence: cfg.holdingLosersConfidence, 
      count: losses.length 
    });
  }

  // 5. AVERAGING DOWN
  // Multiple entries for the same asset while previous entry is in drawdown.
  let avgDownCount = 0;
  const activeEntries = new Map(); // symbol -> lastEntryTime
  sorted.forEach(t => {
    if (activeEntries.has(t.symbol)) {
       const prevTime = activeEntries.get(t.symbol);
       if (t.entryTime < prevTime + (1000 * 60 * 60 * cfg.averagingDownWindowHours)) {
          avgDownCount++;
       }
    }
    activeEntries.set(t.symbol, t.entryTime);
  });
  if (avgDownCount > 0) {
    patterns.push({ type: "AVERAGING_DOWN", confidence: cfg.averagingDownConfidence, count: avgDownCount });
  }

  // Calculate Discipline Score
  // Weighted penalty for each detected pattern
  const totalPenalty = patterns.reduce((acc, p) => acc + (p.confidence / 2), 0);
  const disciplineScore = Math.max(0, 100 - totalPenalty);

  return {
    ...createValidStatus(),
    success: true,
    patterns,
    dominantMistake: patterns.sort((a, b) => b.confidence - a.confidence)[0]?.type || "NONE",
    disciplineScore: Number(disciplineScore.toFixed(2))
  };
};

module.exports = { analyzeBehavior };
