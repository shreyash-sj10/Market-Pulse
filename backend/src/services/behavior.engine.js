/**
 * BEHAVIOR ENGINE
 *
 * Analyzes a sequence of ClosedTrade objects to detect psychological failure patterns.
 * All thresholds are config-driven. No hardcoded values.
 *
 * Patterns detected:
 *   REVENGE_TRADING   — re-entry in same symbol within an exponential window after a loss
 *                       (window doubles with each consecutive loss: base × 2^n, capped at 4×)
 *   OVERTRADING       — average trades/day exceeds daily limit (historical) +
 *                       single-day burst above daily cap (OVERTRADING_DAILY)
 *   EARLY_EXIT_PATTERN— closed trades tagged EARLY_EXIT
 *   HOLDING_LOSERS    — loss positions held significantly longer than winning positions
 *   LOSS_CHASING      — re-entry same symbol shortly after a losing closed trade
 *   FOMO_ENTRY        — intraday entry within fomoMinutesBeforeClose of market close
 *   PANIC_EXIT        — position closed within 10 min of entry (time-based detection)
 *   CHASING_PRICE     — actual entry price exceeded planned entry by chasingPriceMinDriftPct
 */
const { SYSTEM_CONFIG } = require("../config/system.config");
const {
  createUnavailableStatus,
  createValidStatus,
} = require("../constants/intelligenceStatus");
const { getSquareoffMinutesIst } = require("./marketHours.service");

const cfg = () => SYSTEM_CONFIG.behavior;

// ---------------------------------------------------------------------------
// IST time helpers
// ---------------------------------------------------------------------------
const IST_TZ = "Asia/Kolkata";

/** Returns minutes-since-midnight in IST for a given epoch ms. */
const getIstMinutes = (epochMs) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(epochMs));
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  const h = Number(map.hour);
  const m = Number(map.minute);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : -1;
};

/** Returns the IST calendar date string (YYYY-MM-DD) for a given epoch ms. */
const getIstDateString = (epochMs) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs));
};

// ---------------------------------------------------------------------------
// Main analyzer
// ---------------------------------------------------------------------------
const analyzeBehavior = (closedTrades) => {
  const c = cfg();

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

  const validClosedTrades = closedTrades.filter((t) => t && t.exitTime && t.entryTime);
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

  if (sorted.length < c.minClosedTradesForProfile) {
    return {
      ...createUnavailableStatus("INSUFFICIENT_BEHAVIOR_HISTORY"),
      success: false,
      patterns: [],
      dominantMistake: null,
      disciplineScore: null,
      winRate: null,
      avgPnlPct: null,
    };
  }

  const patterns = [];

  // -------------------------------------------------------------------------
  // 1. REVENGE_TRADING — same-symbol re-entry within exponential window after loss
  //    Window doubles with each consecutive loss in the sequence:
  //      1 consecutive loss  → base × 2^0 = base (e.g. 60 min)
  //      2 consecutive losses → base × 2^1 = 2× base (120 min)
  //      3+ consecutive losses → base × 2^2 = 4× base (240 min) [capped]
  // -------------------------------------------------------------------------
  const revengeBaseMs = c.revengeBaseWindowMinutes * 60 * 1000;
  let revengeCount = 0;
  let consecutiveLossCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      if (prev.pnlPaise < 0 && prev.symbol === curr.symbol) {
        // Exponential window: cap exponent at 2 (gives max 4× base)
        const exponent = Math.min(consecutiveLossCount, 2);
        const windowMs = revengeBaseMs * Math.pow(2, exponent);
        const timeGapMs = curr.entryTime - prev.exitTime;
        if (timeGapMs > 0 && timeGapMs < windowMs) {
          revengeCount++;
        }
      }
    }
    // Update consecutive loss counter AFTER evaluating the re-entry check.
    if (curr.pnlPaise < 0) {
      consecutiveLossCount++;
    } else {
      consecutiveLossCount = 0;
    }
  }

  if (revengeCount > 0) {
    patterns.push({
      type: "REVENGE_TRADING",
      confidence: Math.min(100, (revengeCount / sorted.length) * c.revengeConfidenceScale),
      count: revengeCount,
    });
  }

  // -------------------------------------------------------------------------
  // 2. OVERTRADING — two-tier detection
  //    a) Historical average: trades/day over full history exceeds overtradingPerDayLimit
  //    b) Daily burst: any single IST calendar day exceeds overtradingDailyCap
  // -------------------------------------------------------------------------
  const firstTime = sorted[0].entryTime;
  const lastTime = sorted[sorted.length - 1].exitTime;
  const totalDays = Math.max(1, (lastTime - firstTime) / (1000 * 60 * 60 * 24));
  const tradesPerDay = sorted.length / totalDays;

  if (tradesPerDay > c.overtradingPerDayLimit) {
    patterns.push({
      type: "OVERTRADING",
      confidence: Math.min(100, (tradesPerDay / c.overtradingPerDayLimit) * c.overtradingConfidenceScale),
      count: Math.round(tradesPerDay),
    });
  }

  // Daily burst detection — bucket trades by IST calendar date.
  const dailyBuckets = new Map();
  for (const t of sorted) {
    const dateKey = getIstDateString(t.entryTime);
    dailyBuckets.set(dateKey, (dailyBuckets.get(dateKey) || 0) + 1);
  }
  const maxDailyTrades = Math.max(...dailyBuckets.values());
  if (maxDailyTrades > c.overtradingDailyCap) {
    patterns.push({
      type: "OVERTRADING_DAILY",
      confidence: Math.min(100, (maxDailyTrades / c.overtradingDailyCap) * c.overtradingConfidenceScale),
      count: maxDailyTrades,
    });
  }

  // -------------------------------------------------------------------------
  // 3. EARLY_EXIT_PATTERN — from existing trade tags
  // -------------------------------------------------------------------------
  const earlyExits = sorted.filter(
    (t) =>
      t.behaviorTags?.includes("EARLY_EXIT") ||
      t.decisionSnapshot?.exit?.executionPattern === "EARLY_EXIT"
  ).length;
  if (earlyExits > 0) {
    patterns.push({
      type: "EARLY_EXIT_PATTERN",
      confidence: Math.min(100, (earlyExits / sorted.length) * c.earlyExitConfidenceScale),
      count: earlyExits,
    });
  }

  // -------------------------------------------------------------------------
  // 4. HOLDING_LOSERS — loss positions held longer than winning positions
  // -------------------------------------------------------------------------
  const losses = sorted.filter((t) => t.pnlPaise < 0);
  const wins = sorted.filter((t) => t.pnlPaise > 0);
  const avgLossHold =
    losses.length > 0
      ? losses.reduce((acc, t) => acc + (t.holdTime || 0), 0) / losses.length
      : 0;
  const avgWinHold =
    wins.length > 0
      ? wins.reduce((acc, t) => acc + (t.holdTime || 0), 0) / wins.length
      : 0;
  if (losses.length > 0 && avgLossHold > avgWinHold * c.holdingLosersMultiplier) {
    patterns.push({
      type: "HOLDING_LOSERS",
      confidence: c.holdingLosersConfidence,
      count: losses.length,
    });
  }

  // -------------------------------------------------------------------------
  // 5. LOSS_CHASING — re-entry same symbol shortly after a losing closed trade
  // -------------------------------------------------------------------------
  let lossChaseCount = 0;
  const activeEntries = new Map();

  sorted.forEach((t) => {
    if (activeEntries.has(t.symbol)) {
      const prev = activeEntries.get(t.symbol);
      const isWithinWindow =
        t.entryTime < prev.entryTime + 1000 * 60 * 60 * c.averagingDownWindowHours;
      const wasLosingPosition =
        prev.entryPricePaise > 0 && prev.exitPricePaise < prev.entryPricePaise;
      if (isWithinWindow && wasLosingPosition) {
        lossChaseCount++;
      }
    }
    activeEntries.set(t.symbol, {
      entryTime: t.entryTime,
      entryPricePaise: t.entryPricePaise,
      exitPricePaise: t.exitPricePaise,
    });
  });

  if (lossChaseCount > 0) {
    patterns.push({
      type: "LOSS_CHASING",
      confidence: c.averagingDownConfidence,
      count: lossChaseCount,
    });
  }

  // -------------------------------------------------------------------------
  // 6. FOMO_ENTRY — intraday entry within fomoMinutesBeforeClose of squareoff time
  //    Detectable from historical entryTime: if entry was in the FOMO window,
  //    the trade was taken when the market was about to close (fear of missing out
  //    on same-day moves forces rushed, unplanned entries).
  // -------------------------------------------------------------------------
  const squareoffMinutes = getSquareoffMinutesIst(); // e.g. 920 for 15:20
  const fomoThreshold = squareoffMinutes - c.fomoMinutesBeforeClose; // e.g. 895 for 14:55

  const fomoEntries = sorted.filter((t) => {
    if (!t.entryTime) return false;
    const entryMinutes = getIstMinutes(t.entryTime);
    return entryMinutes >= fomoThreshold && entryMinutes < squareoffMinutes;
  }).length;

  if (fomoEntries > 0) {
    patterns.push({
      type: "FOMO_ENTRY",
      confidence: Math.min(100, (fomoEntries / sorted.length) * c.earlyExitConfidenceScale),
      count: fomoEntries,
    });
  }

  // -------------------------------------------------------------------------
  // 7. PANIC_EXIT — position closed within 10 min of entry
  //    Detectable from (exitTime - entryTime) on historical closed trades.
  // -------------------------------------------------------------------------
  const panicThresholdMs = Number(process.env.PANIC_EXIT_THRESHOLD_MS || 10 * 60 * 1000);
  const panicExits = sorted.filter((t) => {
    if (!t.entryTime || !t.exitTime) return false;
    return t.exitTime - t.entryTime < panicThresholdMs;
  }).length;

  if (panicExits > 0) {
    patterns.push({
      type: "PANIC_EXIT",
      confidence: Math.min(100, (panicExits / sorted.length) * c.earlyExitConfidenceScale),
      count: panicExits,
    });
  }

  // -------------------------------------------------------------------------
  // 8. CHASING_PRICE — actual entry price exceeded terminal open price by drift threshold.
  //    If the stock was at X at market open and the user entered at X * (1 + drift),
  //    they bought into an already-running move instead of waiting for a pullback.
  //    Reference: terminalOpenPricePaise (price at 09:15 IST for that trading day).
  // -------------------------------------------------------------------------
  const driftThreshold = c.chasingPriceMinDriftPct; // e.g. 0.02 = 2%
  const chasingEntries = sorted.filter((t) => {
    const terminalOpen = t.terminalOpenPricePaise;
    const actual = t.entryPricePaise;
    if (!terminalOpen || !actual || terminalOpen <= 0) return false;
    return actual >= terminalOpen * (1 + driftThreshold);
  }).length;

  if (chasingEntries > 0) {
    patterns.push({
      type: "CHASING_PRICE",
      confidence: Math.min(100, (chasingEntries / sorted.length) * c.earlyExitConfidenceScale),
      count: chasingEntries,
    });
  }

  // -------------------------------------------------------------------------
  // Discipline score — penalty per pattern proportional to confidence
  // -------------------------------------------------------------------------
  const totalPenalty = patterns.reduce((acc, p) => acc + p.confidence / 2, 0);
  const disciplineScore = Math.max(0, 100 - totalPenalty);

  const winRate = (wins.length / sorted.length) * 100;
  const avgPnlPct =
    sorted.length > 0
      ? sorted.reduce((acc, t) => acc + (t.pnlPct || 0), 0) / sorted.length
      : 0;

  return {
    ...createValidStatus(),
    success: true,
    patterns,
    dominantMistake:
      [...patterns].sort((a, b) => b.confidence - a.confidence)[0]?.type || "NONE",
    disciplineScore: Number(disciplineScore.toFixed(2)),
    winRate: Number(winRate.toFixed(2)),
    avgPnlPct: Number(avgPnlPct.toFixed(2)),
  };
};

module.exports = { analyzeBehavior };
