/**
 * SKILL ENGINE (HARDENED)
 * Quantifies institutional-grade trading skill by prioritizing process over outcome.
 * Operates exclusively on deterministic outputs from reflection, behavior, and progression engines.
 *
 * PHASE 6 FIX: Discipline score deferred until 5+ reflections (avoids single-trade overreaction).
 * PHASE 7 FIX: Consistency score null when behavior data is unavailable (avoids fake perfect scores).
 */
const MINIMUM_DISCIPLINE_SAMPLE = 5;

const calculateSkillScore = (closedTrades, reflectionResults, behaviorOutput, progressionOutput) => {
  const defaults = {
    score: 0,
    level: "BEGINNER",
    breakdown: { discipline: null, behavior: null, consistency: null, riskQuality: 0, learning: 0 },
    strengths: [],
    weaknesses: []
  };

  if (!closedTrades || !Array.isArray(closedTrades) || closedTrades.length === 0) {
    return defaults;
  }

  if (!reflectionResults || !behaviorOutput || !progressionOutput) {
    return defaults;
  }

  // 1. DISCIPLINE (30%) — Average deviation score from plan execution
  // PHASE 6 FIX: Require minimum 5 reflections to avoid harsh judgment on single trades.
  let discipline = null;
  if (reflectionResults.length >= MINIMUM_DISCIPLINE_SAMPLE) {
    discipline = reflectionResults.reduce((acc, r) => acc + (r.deviationScore || 0), 0) / reflectionResults.length;
  }

  // 2. BEHAVIOR (25%) — Deterministic score from pattern detection
  const behavior = behaviorOutput.success ? (behaviorOutput.disciplineScore ?? 0) : null;

  // 3. CONSISTENCY (20%) — Penalty for variety of negative patterns detected
  // PHASE 7 FIX: Return null when behavior data is insufficient (no fake 100% for new users).
  let consistency = null;
  if (behaviorOutput.success) {
    const uniquePatterns = new Set((behaviorOutput.patterns || []).map(p => p.type)).size;
    consistency = Math.max(0, 100 - (uniquePatterns * 25));
  }

  // 4. RISK QUALITY (15%) — Percentage of trades that adhered to the minimum 1.2 RR protocol
  // rr is now guaranteed by closedTrade.mapper (falls back to computed value)
  const highQualityTrades = closedTrades.filter(t => t.rr != null && t.rr >= 1.2).length;
  const riskQuality = closedTrades.length > 0 ? (highQualityTrades / closedTrades.length) * 100 : 0;

  // 5. LEARNING IMPROVEMENT (10%) — Based on progression trend
  let learning = 50; // neutral default (no progression data)
  if (progressionOutput.success) {
    if (progressionOutput.trend === "IMPROVING") learning = 100;
    if (progressionOutput.trend === "DECLINING") learning = 0;
  }

  // FINAL WEIGHTED CALCULATION
  // Null components are excluded from the weighted sum and their weight redistributed proportionally.
  const components = [
    { value: discipline, weight: 0.30 },
    { value: behavior, weight: 0.25 },
    { value: consistency, weight: 0.20 },
    { value: riskQuality, weight: 0.15 },
    { value: learning, weight: 0.10 },
  ];

  const available = components.filter(c => c.value !== null);
  const totalWeight = available.reduce((acc, c) => acc + c.weight, 0);
  const rawScore = totalWeight > 0
    ? available.reduce((acc, c) => acc + (c.value * c.weight), 0) / totalWeight
    : 0;
  const finalScore = Math.round(rawScore);

  // 0–100 → Level mapping
  let level = "BEGINNER";
  let identity = "IMPULSIVE_AMATEUR";
  if (finalScore >= 85) { level = "PROFESSIONAL"; identity = "DISCIPLINED_STRATEGIST"; }
  else if (finalScore >= 70) { level = "CONSISTENT"; identity = "PROTOCOL_EXECUTIONER"; }
  else if (finalScore >= 40) { level = "DEVELOPING"; identity = "DEVELOPING_ADAPTIVE"; }

  // Narrative — null-safe guards on all components
  let narrative;
  if (discipline === null) {
    narrative = "Insufficient trade history to evaluate discipline reliably. Complete at least 5 trades.";
  } else if (discipline < 50) {
    narrative = "Critical risk: Discipline scores are low due to chronic protocol deviations. Prioritize rule adherence over raw profit.";
  } else if (riskQuality < 60) {
    narrative = "Strategic warning: Your Risk/Reward selection is suboptimal. Focus on higher probability setups with >1.5 RR.";
  } else if (progressionOutput.success && progressionOutput.trend === "IMPROVING" && discipline >= 70) {
    narrative = "Strategic growth detected: Your discipline is improving, leading to more deterministic outcomes. Maintain this trajectory.";
  } else if (consistency !== null && consistency < 50) {
    narrative = "Behavioral alert: Multiple psychological failure patterns detected. Consider a trading hiatus to recalibrate emotional state.";
  } else {
    narrative = "Your trading behavior is stabilizing. Maintain focus on protocol adherence.";
  }

  // Strengths / Weaknesses — null-safe
  const strengths = [];
  const weaknesses = [];
  if (discipline !== null && discipline > 80) strengths.push("Strong Plan Adherence");
  if (riskQuality > 70) strengths.push("High Risk-Reward Selection");
  // PHASE 2 FIX: Weakness label is context-aware — reflects actual dominant pattern, not a hardcoded guess.
  if (discipline !== null && discipline < 50) {
    const dominant = behaviorOutput?.dominantMistake;
    if (dominant === "HOLDING_LOSERS") {
      weaknesses.push("Holding losses beyond stop-loss discipline");
    } else if (dominant === "LOSS_CHASING") {
      weaknesses.push("Re-entering losing trades (loss chasing)");
    } else if (dominant === "EARLY_EXIT_PATTERN") {
      weaknesses.push("Exiting profitable trades too early");
    } else {
      weaknesses.push("Inconsistent trade discipline");
    }
  }
  if (consistency !== null && consistency < 50) weaknesses.push("Behavioral Pattern Proliferation");

  return {
    score: finalScore,
    level,
    identity,
    narrative,
    breakdown: {
      discipline: discipline !== null ? Math.round(discipline) : null,
      behavior: behavior !== null ? Math.round(behavior) : null,
      consistency: consistency !== null ? Math.round(consistency) : null,
      riskQuality: Math.round(riskQuality),
      learning: Math.round(learning)
    },
    strengths,
    weaknesses
  };

};

module.exports = { calculateSkillScore };
