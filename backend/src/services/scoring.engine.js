/**
 * DETERMINISTIC DECISION SCORING ENGINE
 * Calculates a 0-100 score based on mathematical market context.
 */

const calculateDecisionScore = (trade) => {
  const breakdown = {
    intent: 0,
    context: 0,
    discipline: 25, // Start full
    efficiency: 25  // Start full
  };

  // 1. INTENT VALIDITY (25)
  const strategyMatch = trade.analysis?.strategyMatch;
  if (strategyMatch) {
    breakdown.intent = strategyMatch.isValid ? 25 : 10;
  } else {
    breakdown.intent = 15; // Default if no analysis yet
  }

  // 2. CONTEXT ALIGNMENT (25)
  const ctx = trade.marketContextAtEntry;
  if (ctx) {
    let contextScore = 0;
    // Trend Alignment
    if (trade.type === 'BUY' && ctx.trend === 'BULLISH') contextScore += 10;
    if (trade.type === 'SELL' && ctx.trend === 'BEARISH') contextScore += 10;
    
    // RSI Optimal Zones
    if (trade.type === 'BUY' && ctx.rsi < 40) contextScore += 10; // Value buy
    if (trade.type === 'BUY' && ctx.rsi > 60) contextScore += 5;  // Momentum buy
    if (trade.type === 'SELL' && ctx.rsi > 70) contextScore += 10; // Overbought exit
    
    // Volatility Guard
    if (ctx.volatility < 1.5) contextScore += 5;

    breakdown.context = Math.min(25, contextScore);
  } else {
    breakdown.context = 15;
  }

  // 3. EXECUTION DISCIPLINE (25)
  const mistakes = trade.analysis?.mistakeTags || [];
  const disciplinePenalty = mistakes.length * 10;
  breakdown.discipline = Math.max(0, 25 - disciplinePenalty);

  // 4. OUTCOME EFFICIENCY (25)
  if (trade.type === 'SELL') {
    const missed = trade.missedOpportunity;
    if (missed && missed.maxProfitPct > 0) {
      // Penalty based on percentage of move left on table
      // e.g. if 5% move missed, penalize more.
      const efficiencyPenalty = Math.min(25, missed.maxProfitPct * 2);
      breakdown.efficiency = Math.max(0, 25 - efficiencyPenalty);
    } else {
      breakdown.efficiency = 25; // Perfect exit
    }
  } else {
    // Current Trade (BUY) efficiency is perfect until proven otherwise
    breakdown.efficiency = 25;
  }

  const totalScore = breakdown.intent + breakdown.context + breakdown.discipline + breakdown.efficiency;

  return {
    totalScore: Math.round(totalScore),
    breakdown
  };
};

module.exports = { calculateDecisionScore };
