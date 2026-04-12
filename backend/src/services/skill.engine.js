/**
 * TRADER SKILL SCORE ENGINE
 * Quantifies professional skill using weighted multi-dimensional analysis.
 * STRIKE MODE: Avoid rewarding luck.
 */

const calculateSkillScore = (trades, behaviorAnalysis, progressionAnalysis) => {
  if (!trades || trades.length < 2) {
    return {
      score: 50,
      level: "EVALUATING",
      trend: "NEUTRAL",
      breakdown: {},
      message: "Processing initial execution nodes..."
    };
  }

  const closedTrades = trades.filter(t => t.type === 'SELL');
  if (closedTrades.length === 0) return { score: 50, level: "NEW_ENTRY", trend: "NEUTRAL" };

  // 1. DECISION QUALITY (30%) - Adherence to 'GOOD' verdicts
  const goodTrades = closedTrades.filter(t => t.learningOutcome?.verdict === 'GOOD').length;
  const decisionQuality = (goodTrades / closedTrades.length) * 100;

  // 2. OUTCOME EFFICIENCY (20%) - Measured by missed opportunities
  const efficiencies = closedTrades.map(t => {
     const missed = t.missedOpportunity?.maxProfitPct || 0;
     // Penalize if more than 5% was left on the table
     return Math.max(0, 100 - (missed * 10));
  });
  const outcomeEfficiency = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length;

  // 3. BEHAVIORAL DISCIPLINE (25%) - From Behavior Engine
  const behavioralDiscipline = behaviorAnalysis.riskProfile?.disciplineScore || 50;

  // 4. RISK MANAGEMENT (15%) - Avoidance of High Risk scores
  const riskManagement = 100 - (behaviorAnalysis.riskProfile?.avgRiskScore || 50);

  // 5. LEARNING IMPROVEMENT (10%) - Based on Delta
  let learningImprovement = 50;
  if (progressionAnalysis.success) {
    if (progressionAnalysis.progression.trend === "IMPROVING") learningImprovement = 90;
    if (progressionAnalysis.progression.trend === "DECLINING") learningImprovement = 20;
  }
  
  // FINAL WEIGHTED CALCULATION
  const finalScore = Math.round(
    (decisionQuality * 0.30) +
    (outcomeEfficiency * 0.20) +
    (behavioralDiscipline * 0.25) +
    (riskManagement * 0.15) +
    (learningImprovement * 0.10)
  );

  // DETERMINISTIC LEVEL MAPPING
  let level = "NOVICE";
  if (finalScore >= 85) level = "INSTITUTIONAL";
  else if (finalScore >= 70) level = "PROFESSIONAL";
  else if (finalScore >= 50) level = "CONSISTENT";
  else if (finalScore >= 30) level = "AMATEUR";

  // GENETIC STRENGTHS & WEAKNESSES
  const strengths = [];
  const weaknesses = [];
  if (decisionQuality > 70) strengths.push("High Strategic Adherence");
  if (riskManagement > 70) strengths.push("Strict Risk Guardrails");
  if (outcomeEfficiency < 40) weaknesses.push("Sub-optimal Exit Timing");
  if (behavioralDiscipline < 40) weaknesses.push("Behavioral Instability");

  return {
    score: finalScore,
    level,
    trend: progressionAnalysis.progression?.trend || "STABLE",
    breakdown: {
      decisionQuality: Math.round(decisionQuality),
      outcomeEfficiency: Math.round(outcomeEfficiency),
      behavioralDiscipline: Math.round(behavioralDiscipline),
      riskManagement: Math.round(riskManagement),
      learningImprovement: Math.round(learningImprovement)
    },
    strengths,
    weaknesses,
    suggestion: strengths.length < 2 ? "Focus on following entry protocols without deviation." : "Your discipline is high; focus on optimizing exit efficiency."
  };
};

module.exports = { calculateSkillScore };
