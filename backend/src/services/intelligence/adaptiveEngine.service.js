const Trade = require("../../models/trade.model");

/**
 * ADAPTIVE INTELLIGENCE ENGINE — USER-AWARE SYSTEM EVOLUTION
 */

const getAdaptiveProfile = async (userId) => {
  const trades = await Trade.find({ user: userId }).sort({ createdAt: -1 }).limit(15);
  
  const tagCounts = {};
  let totalLosses = 0;
  let totalWins = 0;

  trades.forEach(t => {
     (t.intelligenceTimeline?.learningTags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
     });
     if (t.intelligenceTimeline?.postTrade?.outcome === "LOSS") totalLosses++;
     if (t.intelligenceTimeline?.postTrade?.outcome === "WIN") totalWins++;
  });

  const dominantPatterns = Object.keys(tagCounts).map(tag => ({
     tag,
     count: tagCounts[tag],
     strength: tagCounts[tag] > 3 ? "STRONG_PATTERN" : "EMERGING_PATTERN"
  })).sort((a, b) => b.count - a.count);

  const sensitivityLevel = dominantPatterns.some(p => p.strength === "STRONG_PATTERN") ? "HIGH" : "MEDIUM";
  const riskBias = totalWins > totalLosses * 1.5 ? "CONSERVATIVE" : "AGGRESSIVE";

  return {
    userId,
    sensitivityLevel,
    dominantPatterns,
    riskBias,
    rulesApplied: [
       sensitivityLevel === "HIGH" ? "ELEVATED_RISK_SENSITIVITY" : "STANDARD_GUARDRAILS",
       riskBias === "AGGRESSIVE" ? "TIGHT_STOPLOSS_ENFORCEMENT" : "PROFIT_PROTECTION_MODE"
    ]
  };
};

const adaptWarning = async (riskReport, userProfile) => {
  const strongPatterns = userProfile.dominantPatterns.filter(p => p.strength === "STRONG_PATTERN");
  
  let adaptedRiskLevel = riskReport.riskLevel;
  let adaptiveMessage = riskReport.reasoning[0] || "Standard risk parameters applied.";
  const appliedAdjustments = [];

  if (strongPatterns.length > 0) {
    // Increase severity if history repeats
    if (adaptedRiskLevel === "LOW") adaptedRiskLevel = "MEDIUM";
    appliedAdjustments.push(`Risk elevated due to recurring ${strongPatterns[0].tag}`);
    
    if (strongPatterns.some(p => p.tag === "TREND_IGNORED")) {
       adaptiveMessage = `Persistent Pattern Detected: You frequently enter against the trend. This execution carries high counter-trend risk.`;
    } else if (strongPatterns.some(p => p.tag === "REVENGE_TRADING")) {
       adaptiveMessage = `Psychological Anchor Detected: Behavioral history suggests high probability of revenge trading in this window.`;
    }
  }

  return {
    adaptedRiskLevel,
    adaptiveMessage,
    appliedAdjustments,
    confidence: 0.95,
    trace: `Profile adjustment based on ${strongPatterns.length} strong patterns.`
  };
};

module.exports = { getAdaptiveProfile, adaptWarning };
