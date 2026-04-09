const Decimal = require("decimal.js");

/**
 * BEHAVIORAL PATTERN ENGINE (Deterministic Rule-Based)
 * Analyzes round-trip trades to detect psychological and strategic failure patterns.
 */
const analyzeBehavior = (trades) => {
  // Guard: Requirement for minimum 10 trades
  if (!trades || trades.length < 10) {
    return { success: false, error: "INSUFFICIENT_DATA" };
  }

  // Filter out any incomplete trades per requirement
  const closedTrades = trades.filter(t => t.closedAt && t.createdAt);
  if (closedTrades.length < 10) {
    return { success: false, error: "INSUFFICIENT_DATA" };
  }

  // Sort by closedAt to maintain chronological sequence
  const sorted = [...closedTrades].sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt));

  const stats = {
    total: sorted.length,
    wins: sorted.filter(t => t.pnl > 0).length,
    losses: sorted.filter(t => t.pnl <= 0).length,
  };

  const winRate = stats.wins / stats.total;

  // Pattern Detection logic
  const patterns = [];

  // 1. REVENGE TRADING
  let revengeMatches = 0;
  let revengeOpportunities = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.pnl <= 0) {
      revengeOpportunities++;
      const timeGap = (new Date(curr.createdAt) - new Date(prev.closedAt)) / (1000 * 60);
      if (timeGap < 60 && curr.riskScore > prev.riskScore) {
        revengeMatches++;
      }
    }
  }
  const revengeConfidence = revengeOpportunities > 0 ? revengeMatches / revengeOpportunities : 0;
  if (revengeConfidence >= 0.3) {
    patterns.push({ 
      name: "Revenge Trading", 
      confidence: Number((revengeConfidence * 100).toFixed(0)), 
      severity: revengeConfidence > 0.6 ? "CRITICAL" : "MODERATE",
      evidence: { matches: revengeMatches, opportunities: revengeOpportunities },
      description: "Capital exposure increased immediately following a realized loss." 
    });
  }

  // 2. OVERTRADING
  const days = Math.max(1, (new Date(sorted[sorted.length - 1].closedAt) - new Date(sorted[0].createdAt)) / (1000 * 60 * 60 * 24));
  const tradesPerDay = sorted.length / days;
  const overtradingConfidence = tradesPerDay > 5 ? Math.min(1, tradesPerDay / 10) : 0;
  if (overtradingConfidence >= 0.3) {
    patterns.push({ 
      name: "Overtrading", 
      confidence: Number((overtradingConfidence * 100).toFixed(0)), 
      severity: tradesPerDay > 8 ? "CRITICAL" : "MODERATE",
      evidence: { frequency: Number(tradesPerDay.toFixed(1)), benchmark: 5 },
      description: "Excessive execution frequency detected relative to market opportunity." 
    });
  }

  // 3. EARLY EXIT
  const winTrades = sorted.filter(t => t.pnl > 0);
  const avgProfitPct = winTrades.reduce((acc, t) => acc + (t.profitPct || 0), 0) / (winTrades.length || 1);
  if (avgProfitPct < 0.02 && winRate > 0.4) {
    patterns.push({ 
      name: "Early Exit", 
      confidence: 80, 
      severity: "MODERATE",
      evidence: { avgReturn: Number((avgProfitPct * 100).toFixed(2)), winRate: Number((winRate * 100).toFixed(0)) },
      description: "Positions liquidated prematurely before reaching full alpha potential." 
    });
  }

  // 4. HOLDING LOSERS
  const lossTrades = sorted.filter(t => t.pnl <= 0);
  const avgWinDuration = winTrades.reduce((acc, t) => acc + (new Date(t.closedAt) - new Date(t.createdAt)), 0) / (winTrades.length || 1);
  const avgLossDuration = lossTrades.reduce((acc, t) => acc + (new Date(t.closedAt) - new Date(t.createdAt)), 0) / (lossTrades.length || 1);
  if (avgLossDuration > avgWinDuration) {
    patterns.push({ 
      name: "Holding Losers", 
      confidence: 70, 
      severity: avgLossDuration > avgWinDuration * 2 ? "CRITICAL" : "MODERATE",
      evidence: { lossDurationMin: Math.round(avgLossDuration/60000), winDurationMin: Math.round(avgWinDuration/60000) },
      description: "Exposure to drawdown maintained significantly longer than winning sessions." 
    });
  }

  // 5. AVERAGING DOWN
  let avgDownMatches = 0;
  let avgDownOpportunities = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.pnl <= 0) {
      avgDownOpportunities++;
      const timeGap = (new Date(curr.createdAt) - new Date(prev.closedAt)) / (1000 * 60);
      if (timeGap < 120 && curr.symbol === prev.symbol) {
        avgDownMatches++;
      }
    }
  }
  const avgDownConfidence = avgDownOpportunities > 0 ? avgDownMatches / avgDownOpportunities : 0;
  if (avgDownConfidence >= 0.3) {
    patterns.push({ 
      name: "Averaging Down", 
      confidence: Number((avgDownConfidence * 100).toFixed(0)), 
      severity: avgDownConfidence > 0.5 ? "CRITICAL" : "MODERATE",
      evidence: { matches: avgDownMatches, opportunities: avgDownOpportunities },
      description: "Capital injected into depreciating assets to lower cost basis." 
    });
  }

  // Dominant Mistake
  const sortedByConfidence = [...patterns].sort((a, b) => b.confidence - a.confidence);
  const dominantMistake = sortedByConfidence[0]?.name || "None Detected";

  // Risk Profile
  const avgRiskScore = sorted.reduce((acc, t) => acc + (t.riskScore || 0), 0) / sorted.length;
  // Variance
  const variance = sorted.reduce((acc, t) => acc + Math.pow((t.riskScore || 0) - avgRiskScore, 2), 0) / sorted.length;
  const consistencyScore = Math.max(0, 100 - Math.sqrt(variance) * 2);
  const disciplineScore = Math.max(0, 100 - patterns.length * 15);

  return {
    success: true,
    patterns,
    dominantMistake,
    riskProfile: {
      riskTolerance: avgRiskScore > 70 ? "Aggressive" : avgRiskScore > 40 ? "Moderate" : "Conservative",
      consistencyScore: Number(consistencyScore.toFixed(2)),
      disciplineScore: Number(disciplineScore.toFixed(2)),
      avgRiskScore: Number(avgRiskScore.toFixed(2))
    }
  };
};

module.exports = { analyzeBehavior };
