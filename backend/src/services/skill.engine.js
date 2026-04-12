/**
 * SKILL ENGINE (REBUILT)
 * Quantifies institutional-grade trading skill by prioritizing process over outcome.
 * Operates exclusively on deterministic outputs from reflection, behavior, and progression engines.
 */
const calculateSkillScore = (closedTrades, reflectionResults, behaviorOutput, progressionOutput) => {
  const defaults = {
    score: 0,
    level: "BEGINNER",
    breakdown: { discipline: 0, behavior: 0, consistency: 0, riskQuality: 0, learning: 0 },
    strengths: [],
    weaknesses: []
  };

  if (!closedTrades || !Array.isArray(closedTrades) || closedTrades.length === 0) {
    return defaults;
  }

  if (!reflectionResults || !behaviorOutput || !progressionOutput) {
     return defaults;
  }


  // 1. DISCIPLINE (30%) - Average deviation score from plan execution
  const discipline = reflectionResults.reduce((acc, r) => acc + r.deviationScore, 0) / (reflectionResults.length || 1);

  // 2. BEHAVIOR (25%) - Deterministic score from pattern detection
  const behavior = behaviorOutput.disciplineScore || 0;

  // 3. CONSISTENCY (20%) - Measured as 100 minus penalty for variety of negative patterns detected
  const uniquePatterns = new Set((behaviorOutput.patterns || []).map(p => p.type)).size;
  const consistency = Math.max(0, 100 - (uniquePatterns * 25));

  // 4. RISK QUALITY (15%) - Percentage of trades that adhered to the minimum 1.2 RR protocol
  const highQualityTrades = closedTrades.filter(t => t.rr >= 1.2).length;
  const riskQuality = (highQualityTrades / closedTrades.length) * 100;

  // 5. LEARNING IMPROVEMENT (10%) - Based on progression trend
  let learning = 50;
  if (progressionOutput.success) {
    if (progressionOutput.trend === "IMPROVING") learning = 100;
    if (progressionOutput.trend === "DECLINING") learning = 0;
  }

  // FINAL WEIGHTED CALCULATION
  const finalScore = Math.round(
    (discipline * 0.30) +
    (behavior * 0.25) +
    (consistency * 0.20) +
    (riskQuality * 0.15) +
    (learning * 0.10)
  );

  // 0–100 -> Level mapping
  let level = "BEGINNER";
  let identity = "IMPULSIVE_AMATEUR";
  if (finalScore >= 85) { level = "PROFESSIONAL"; identity = "DISCIPLINED_STRATEGIST"; }
  else if (finalScore >= 70) { level = "CONSISTENT"; identity = "PROTOCOL_EXECUTIONER"; }
  else if (finalScore >= 40) { level = "DEVELOPING"; identity = "DEVELOPING_ADAPTIVE"; }

  // 6. Narrative Generation
  let narrative = "Your trading behavior is stabilizing. Maintain focus on protocol adherence.";
  if (discipline < 50) narrative = "Critical risk: Discipline scores are low due to chronic protocol deviations. Prioritize rule adherence over raw profit.";
  else if (riskQuality < 60) narrative = "Strategic warning: Your Risk/Reward selection is suboptimal. Focus on higher probability setups with >1.5 RR.";
  else if (progressionOutput.trend === "IMPROVING" && discipline >= 70) narrative = "Strategic growth detected: Your discipline is improving, leading to more deterministic outcomes. Maintain this trajectory.";
  else if (uniquePatterns > 3) narrative = "Behavioral alert: Multiple psychological failure patterns detected. Consider a trading hiatus to recalibrate emotional state.";

  // Insight Generation
  const strengths = [];
  const weaknesses = [];

  if (discipline > 80) strengths.push("Strong Plan Adherence");
  if (riskQuality > 70) strengths.push("High Risk-Reward Selection");
  if (discipline < 50) weaknesses.push("Chronic Early Exits");
  if (uniquePatterns > 2) weaknesses.push("Behavioral Pattern Proliferation");

  return {
    score: finalScore,
    level,
    identity,
    narrative,
    breakdown: {
      discipline: Math.round(discipline),
      behavior: Math.round(behavior),
      consistency: Math.round(consistency),
      riskQuality: Math.round(riskQuality),
      learning: Math.round(learning)
    },
    strengths,
    weaknesses
  };

};

module.exports = { calculateSkillScore };
