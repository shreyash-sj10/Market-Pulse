/**
 * LAYER 3: SCORING ENGINE
 * Deterministic calculation of Impact, Strength, and Confidence.
 */

const calculateScores = (signals, impactMod, relevance, sourceWeight = 0.5) => {
  // 1. IMPACT
  let finalImpactMod = impactMod;
  // If no specific rules hit, default to AI sentiment
  if (impactMod === 0) {
    finalImpactMod = signals.sentiment === "POSITIVE" ? 0.6 : (signals.sentiment === "NEGATIVE" ? -0.6 : 0);
  }

  const impact = finalImpactMod > 0 ? "BULLISH" : (finalImpactMod < 0 ? "BEARISH" : "NEUTRAL");

  // 2. STRENGTH
  const strength = relevance; // HIGH/MEDIUM/LOW as passed from higher layer

  // 3. CONFIDENCE
  // Formula: (relevance * 0.5) + (AI confidence * 0.3) + (source weight * 0.2)
  const relMap = { "HIGH": 100, "MEDIUM": 75, "LOW": 50 };
  const relevancePoints = relMap[relevance] || 50;
  const aiPoints = signals.confidence || 50;
  const sourcePoints = sourceWeight * 100;

  const confidenceValue = (relevancePoints * 0.5) + (aiPoints * 0.3) + (sourcePoints * 0.2);

  return {
    impact,
    strength,
    confidence: Math.round(confidenceValue)
  };
};

module.exports = { calculateScores };
