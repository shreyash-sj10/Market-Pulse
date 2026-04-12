const { analyzeBehavior } = require("./behavior.engine");

/**
 * PROGRESSION ENGINE (REBUILT)
 * Segment-based temporal analysis comparing recent performance to historical baselines.
 */
const analyzeProgression = (closedTrades) => {
  if (!closedTrades || closedTrades.length < 5) {
    return {
      success: false,
      trend: "STABLE",
      changes: [],
      narrative: "Initial performance window established. Accumulate more trades to unlock progression tracking."
    };
  }

  // Ensure chronological order
  const sorted = [...closedTrades].sort((a, b) => a.exitTime - b.exitTime);

  // Segment: RECENT (Last 20) vs PAST (Previous 20)
  const recent = sorted.slice(-20);
  const remainder = sorted.slice(0, -20);
  const past = remainder.slice(-20);

  if (past.length === 0) {
    return {
      success: false,
      trend: "STABLE",
      changes: [],
      narrative: "Baseline data established. Comparison window will open after 20 trades."
    };
  }

  // 1. Analyze Behavioral Discipline per window
  const recentBeh = analyzeBehavior(recent);
  const pastBeh = analyzeBehavior(past);

  // 2. Compute Segment Metrics
  const calculateWinRate = (arr) => arr.filter(t => t.pnl > 0).length / (arr.length || 1);
  const calculateAvgRR = (arr) => arr.reduce((acc, t) => acc + (t.rr || 0), 0) / (arr.length || 1);
  const calculateAvgHold = (arr) => arr.reduce((acc, t) => acc + (t.holdTime || 0), 0) / (arr.length || 1);

  const metrics = [
    { name: "Win Rate", current: calculateWinRate(recent) * 100, previous: calculateWinRate(past) * 100, higherIsBetter: true },
    { name: "Discipline", current: recentBeh.disciplineScore, previous: pastBeh.disciplineScore, higherIsBetter: true },
    { name: "Plan RR", current: calculateAvgRR(recent), previous: calculateAvgRR(past), higherIsBetter: true },
    { name: "Avg Hold Time", current: calculateAvgHold(recent), previous: calculateAvgHold(past), higherIsBetter: false }
  ];

  // 3. Detect Changes
  const changes = metrics.map(m => {
    const delta = m.current - m.previous;
    const threshold = m.name === "Avg Hold Time" ? 60000 : 0.5; // 1 min or 0.5 units
    
    if (Math.abs(delta) < threshold) return { metric: m.name, status: "STABLE", delta: 0 };
    
    const isImprovement = m.higherIsBetter ? delta > 0 : delta < 0;
    return {
      metric: m.name,
      status: isImprovement ? "IMPROVED" : "DECLINED",
      delta: Number(delta.toFixed(2))
    };
  }).filter(c => c.status !== "STABLE");

  // 4. Final Verdict
  const improvements = changes.filter(c => c.status === "IMPROVED").length;
  const declines = changes.filter(c => c.status === "DECLINED").length;

  let trend = "STABLE";
  let narrative = "Your trading behavior is consistent with your historical norms.";

  if (improvements > declines) {
    trend = "IMPROVING";
    narrative = "Strategic growth detected. You are executing with higher precision and better risk management than in previous sessions.";
  } else if (declines > improvements) {
    trend = "DECLINING";
    narrative = "Process erosion detected. Recent execution patterns indicate a decline in discipline or strategy adherence.";
  }

  return {
    success: true,
    trend,
    changes,
    narrative
  };
};

module.exports = { analyzeProgression };
