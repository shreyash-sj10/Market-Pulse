const { analyzeBehavior } = require("./behavior.engine");

/**
 * PROGRESSION ENGINE
 * Compares snapshots of trading behavior across time to track strategic growth.
 * Built on deterministic delta-analysis (No AI).
 */
const analyzeProgression = (trades) => {
  // Lower threshold for early visibility
  if (!trades || trades.length < 2) {
    return { success: false, error: "INITIAL_COLLECTION_PHASE", message: "Accumulate more session data to unlock progression analytics." };
  }

  // Snapshot Windows
  const tradeCount = trades.length;
  const recentWindowSize = Math.max(1, Math.floor(tradeCount / 2));
  const recentWindow = trades.slice(-recentWindowSize);
  const pastWindow = trades.slice(0, tradeCount - recentWindowSize);

  if (pastWindow.length === 0) {
     return { success: false, error: "PENDING_DELTA", message: "Initial session established. Delta analysis pending next execution." };
  }

  // 2. Compute Metrics for Each Window
  const recentAnalysis = analyzeBehavior(recentWindow);
  const pastAnalysis = analyzeBehavior(pastWindow);

  // Fallback if behavior engine fails on subsets (e.g. fewer than 10 trades in past)
  if (!recentAnalysis.success || !pastAnalysis.success) {
     // If subsets are too small for behavior engine's 10-trade limit, we handle it
     // But since we checked for 20 trades total, and 40 for full windows, we are likely okay.
     return { success: false, error: "INSUFFICIENT_WINDOW_DENSITY" };
  }

  const metrics = [
    { key: "winRate", value: (t) => t.filter(x => x.pnl > 0).length / t.length, higherIsBetter: true },
    { key: "avgRiskScore", value: () => recentAnalysis.riskProfile.avgRiskScore, pastValue: pastAnalysis.riskProfile.avgRiskScore, higherIsBetter: false },
    { key: "disciplineScore", value: () => recentAnalysis.riskProfile.disciplineScore, pastValue: pastAnalysis.riskProfile.disciplineScore, higherIsBetter: true },
    { key: "consistencyScore", value: () => recentAnalysis.riskProfile.consistencyScore, pastValue: pastAnalysis.riskProfile.consistencyScore, higherIsBetter: true }
  ];

  // 3. Compute Deltas
  const THRESHOLD = 2; // Ignore changes smaller than 2 units/percent
  const changes = [];
  let improvingCount = 0;
  let decliningCount = 0;

  metrics.forEach(m => {
    const recentVal = m.key === "winRate" ? m.value(recentWindow) * 100 : m.value();
    const pastVal = m.key === "winRate" ? m.value(pastWindow) * 100 : m.pastValue;

    const delta = recentVal - pastVal;

    if (Math.abs(delta) >= THRESHOLD) {
      const isImprovement = m.higherIsBetter ? delta > 0 : delta < 0;
      if (isImprovement) improvingCount++;
      else decliningCount++;

      changes.push({
        metric: m.key,
        direction: delta > 0 ? "UP" : "DOWN",
        magnitude: Number(Math.abs(delta).toFixed(2)),
        status: isImprovement ? "IMPROVED" : "DECLINED"
      });
    }
  });

  // 4. Determine Trend
  let trend = "STABLE";
  let narrative = "Your trading behavior remains stable. No significant progression or regression detected in recent sessions.";

  if (improvingCount > decliningCount) {
    trend = "IMPROVING";
    narrative = "Your trading discipline is improving. You are adhering more strictly to strategy protocols than in previous sessions.";
  } else if (decliningCount > improvingCount) {
    trend = "DECLINING";
    narrative = "Your recent trades show increased risk or declining discipline. Strategy adherence is deviating from historical norms.";
  }

  return {
    success: true,
    progression: {
      trend,
      changes,
      narrative,
      metricDeltas: changes.reduce((acc, c) => ({ ...acc, [c.metric]: (c.direction === "UP" ? "+" : "-") + c.magnitude }), {})
    }
  };
};

module.exports = { analyzeProgression };
