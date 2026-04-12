/**
 * JOURNAL INSIGHTS ENGINE
 * Aggregates behavioral patterns across closed trades to identify systemic biases.
 */
exports.calculateJournalInsights = (closedTrades) => {
  if (!closedTrades || closedTrades.length === 0) {
    return {
      topMistake: "NONE",
      frequency: 0,
      last10Summary: { winRate: 0, avgPnL: 0 },
      timePatterns: "INSUFFICIENT_DATA",
      disciplineTrend: "STABLE"
    };
  }

  // 1. Mistake Frequency & Top Mistake
  const mistakeMap = {};
  closedTrades.forEach(t => {
    (t.behaviorTags || []).forEach(tag => {
      mistakeMap[tag] = (mistakeMap[tag] || 0) + 1;
    });
  });

  const sortedMistakes = Object.entries(mistakeMap).sort((a, b) => b[1] - a[1]);
  const topMistake = sortedMistakes[0]?.[0] || "NONE";
  const frequency = sortedMistakes[0]?.[1] || 0;

  // 2. Last 10 Trades Summary
  const last10 = closedTrades.slice(-10);
  const wins = last10.filter(t => t.pnl > 0).length;
  const avgPnL = last10.reduce((acc, t) => acc + t.pnlPct, 0) / last10.length;

  // 3. Time-Based Behavior
  // Identify time clusters for Early Exits
  const earlyExits = closedTrades.filter(t => (t.behaviorTags || []).includes("EARLY_EXIT"));
  let timeInsight = "No specific time clusters detected.";
  
  if (earlyExits.length >= 3) {
    const hours = earlyExits.map(t => new Date(t.exitTime).getHours());
    const hourMap = {};
    hours.forEach(h => hourMap[h] = (hourMap[h] || 0) + 1);
    
    const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0][0];
    if (peakHour < 12) {
      timeInsight = `You exit early most frequently during the morning session (${peakHour}:00-${peakHour}:59).`;
    } else {
      timeInsight = `Early exits cluster in the afternoon session (${peakHour}:00-${peakHour}:59).`;
    }
  }

  // 4. Discipline Trend
  // Compare discipline score of last 5 trades vs previous 5
  const getDiscipline = (trades) => {
    const total = trades.length;
    if (total === 0) return 100;
    const mistakes = trades.reduce((acc, t) => acc + (t.behaviorTags?.length || 0), 0);
    return Math.max(0, 100 - (mistakes * 10));
  };

  const recentDiscipline = getDiscipline(closedTrades.slice(-5));
  const previousDiscipline = getDiscipline(closedTrades.slice(-10, -5));
  
  let disciplineTrend = "STABLE";
  if (recentDiscipline > previousDiscipline + 5) disciplineTrend = "IMPROVING";
  else if (recentDiscipline < previousDiscipline - 5) disciplineTrend = "DECLINING";

  return {
    topMistake,
    frequency,
    last10Summary: {
      winRate: Math.round((wins / last10.length) * 100),
      avgPnL: Number(avgPnL.toFixed(2))
    },
    timePatterns: timeInsight,
    disciplineTrend
  };
};
