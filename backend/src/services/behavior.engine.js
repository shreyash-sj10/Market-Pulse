/**
 * BEHAVIOR ENGINE (HARDENED)
 * Strictly consumes ClosedTrade objects to detect psychological failure patterns.
 * All thresholds are config-driven. No hardcoded values.
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
      disciplineScore: null,
      winRate: null,
      avgPnlPct: null,
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
      winRate: null,
      avgPnlPct: null,
    };
  }

  const patterns = [];

  // 1. REVENGE TRADING
  // PHASE 2 FIX: Use single unified window from config, convert to ms here.
  // preTradeGuard also derives from this same value via cfg.revengeWindowMinutes.
  const revengeWindowMs = cfg.revengeWindowMinutes * 60 * 1000;
  let revengeCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    // PHASE 4 FIX: Only flag revenge when the re-entry is in the SAME symbol.
    // Cross-symbol sequential entries (RELIANCE loss → INFY entry) are NOT revenge trading.
    if (prev.symbol !== curr.symbol) continue;
    if (prev.pnlPaise < 0) {
      const timeGapMs = curr.entryTime - prev.exitTime;
      if (timeGapMs > 0 && timeGapMs < revengeWindowMs) {
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
  // Daily average rate — detects systematic frequency abuse, not single-day spikes.
  // Note: This measures avg trades/day. Single-day spikes require bucketed analysis (future enhancement).
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
  const losses = sorted.filter(t => t.pnlPaise < 0);
  const wins = sorted.filter(t => t.pnlPaise > 0);
  const avgLossHold = losses.length > 0
    ? losses.reduce((acc, t) => acc + (t.holdTime || 0), 0) / losses.length
    : 0;
  const avgWinHold = wins.length > 0
    ? wins.reduce((acc, t) => acc + (t.holdTime || 0), 0) / wins.length
    : 0;
  if (losses.length > 0 && avgLossHold > avgWinHold * cfg.holdingLosersMultiplier) {
    patterns.push({ 
      type: "HOLDING_LOSERS", 
      confidence: cfg.holdingLosersConfidence, 
      count: losses.length 
    });
  }

  // 5. AVERAGING DOWN (PHASE 3 FIX)
  // Previous logic: detected any re-entry within time window (WRONG — false positives for profitable re-entries).
  // Fixed logic: ONLY flags re-entries made while the previous position in same symbol was LOSING
  // (i.e., entry price on previous trade > its exit price = it was a loser when we re-entered).
  let avgDownCount = 0;
  const activeEntries = new Map(); // symbol -> { entryTime, entryPricePaise, exitPricePaise }

  sorted.forEach(t => {
    if (activeEntries.has(t.symbol)) {
      const prev = activeEntries.get(t.symbol);
      const isWithinWindow = t.entryTime < prev.entryTime + (1000 * 60 * 60 * cfg.averagingDownWindowHours);
      // A previous position is "losing" if it closed below its entry price
      const wasLosingPosition = prev.entryPricePaise > 0 && prev.exitPricePaise < prev.entryPricePaise;
      if (isWithinWindow && wasLosingPosition) {
        avgDownCount++;
      }
    }
    activeEntries.set(t.symbol, {
      entryTime: t.entryTime,
      entryPricePaise: t.entryPricePaise,
      exitPricePaise: t.exitPricePaise,
    });
  });

  if (avgDownCount > 0) {
    // PHASE 5 FIX: Renamed from AVERAGING_DOWN — the pattern detected here is:
    // "re-entered same symbol shortly after a losing closed trade".
    // This is LOSS_CHASING, not averaging down (which requires an OPEN losing position).
    patterns.push({ type: "LOSS_CHASING", confidence: cfg.averagingDownConfidence, count: avgDownCount });
  }

  // Calculate Discipline Score
  const totalPenalty = patterns.reduce((acc, p) => acc + (p.confidence / 2), 0);
  const disciplineScore = Math.max(0, 100 - totalPenalty);

  // Compute win rate and avg PnL for consumers (patternInsight, progressionEngine)
  const winRate = wins.length / sorted.length * 100;
  const avgPnlPct = sorted.length > 0
    ? sorted.reduce((acc, t) => acc + (t.pnlPct || 0), 0) / sorted.length
    : 0;

  return {
    ...createValidStatus(),
    success: true,
    patterns,
    dominantMistake: [...patterns].sort((a, b) => b.confidence - a.confidence)[0]?.type || "NONE",
    disciplineScore: Number(disciplineScore.toFixed(2)),
    winRate: Number(winRate.toFixed(2)),
    avgPnlPct: Number(avgPnlPct.toFixed(2)),
  };
};

module.exports = { analyzeBehavior };
