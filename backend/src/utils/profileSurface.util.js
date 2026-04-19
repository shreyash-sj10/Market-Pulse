const { analyzeBehavior } = require("../services/behavior.engine");

/**
 * Trade-derived metrics for Profile (closed round-trips only).
 * Safe on empty input; never throws.
 */
function buildProfileSurface(closed, user) {
  if (!closed || closed.length === 0) {
    return {
      maxDrawdownPct: null,
      avgRiskPerTradePct: null,
      consistencyScore: null,
      patternTally: { earlyExit: 0, overtrading: 0, missedEntry: 0 },
      behaviorPatterns: [],
      behaviorDisciplineScore: null,
    };
  }

  const sorted = [...closed].sort((a, b) => a.exitTime - b.exitTime);

  let run = 0;
  let peak = 0;
  let maxDd = 0;
  for (const t of sorted) {
    run += t.pnlPaise || 0;
    peak = Math.max(peak, run);
    maxDd = Math.max(maxDd, peak - run);
  }

  let maxDrawdownPct = null;
  if (peak > 0 && maxDd >= 0) {
    maxDrawdownPct = Number(((maxDd / peak) * 100).toFixed(1));
  } else if (user?.balance > 0 && maxDd > 0) {
    maxDrawdownPct = Number(((maxDd / user.balance) * 100).toFixed(2));
  }

  const riskPcts = sorted
    .map((t) => {
      if (!t.stopLossPaise || !t.entryPricePaise || t.entryPricePaise <= 0) return null;
      return (Math.abs(t.entryPricePaise - t.stopLossPaise) / t.entryPricePaise) * 100;
    })
    .filter((x) => x != null && Number.isFinite(x));

  let avgRiskPerTradePct = null;
  if (riskPcts.length > 0) {
    avgRiskPerTradePct = Number((riskPcts.reduce((a, b) => a + b, 0) / riskPcts.length).toFixed(2));
  } else {
    const absMoves = sorted.map((t) => Math.abs(Number(t.pnlPct) || 0));
    avgRiskPerTradePct = Number((absMoves.reduce((a, b) => a + b, 0) / absMoves.length).toFixed(2));
  }

  const patternTally = { earlyExit: 0, overtrading: 0, missedEntry: 0 };
  let behaviorPatterns = [];
  let behaviorDisciplineScore = null;

  try {
    const b = analyzeBehavior(closed);
    if (b.success && Array.isArray(b.patterns)) {
      behaviorPatterns = b.patterns.map((p) => ({
        type: p.type,
        count: p.count,
        confidence: Number(p.confidence),
      }));
      for (const p of b.patterns) {
        const c = Number(p.count) || 0;
        if (p.type === "EARLY_EXIT_PATTERN") patternTally.earlyExit += c;
        if (p.type === "OVERTRADING" || p.type === "OVERTRADING_DAILY") {
          patternTally.overtrading = Math.max(patternTally.overtrading, c);
        }
        if (p.type === "FOMO_ENTRY" || p.type === "CHASING_PRICE") {
          patternTally.missedEntry += c;
        }
      }
      if (typeof b.disciplineScore === "number" && Number.isFinite(b.disciplineScore)) {
        behaviorDisciplineScore = Number(b.disciplineScore.toFixed(1));
      }
    }
  } catch {
    /* ignore — profile still returns without surface patterns */
  }

  const snapDisc = user?.analyticsSnapshot?.disciplineScore;
  let consistencyScore = null;
  if (typeof snapDisc === "number" && Number.isFinite(snapDisc)) {
    consistencyScore = Math.round(snapDisc);
  } else if (behaviorDisciplineScore != null) {
    consistencyScore = Math.round(behaviorDisciplineScore);
  } else if (typeof user?.analyticsSnapshot?.skillScore === "number") {
    consistencyScore = Math.round(user.analyticsSnapshot.skillScore);
  }

  return {
    maxDrawdownPct,
    avgRiskPerTradePct,
    consistencyScore,
    patternTally,
    behaviorPatterns,
    behaviorDisciplineScore,
  };
}

module.exports = { buildProfileSurface };
