/**
 * DETERMINISTIC INSIGHT ENGINE
 * Converts behavior patterns into human-readable strategic advisory.
 * Built strictly on rule-based mapping (No AI/LLM used).
 */

const PATTERN_MAP = {
  "Revenge Trading": {
    explanation: "You increase risk after losses to recover quickly.",
    suggestion: "Introduce a mandatory 1-hour cooldown period after any realized loss."
  },
  "Overtrading": {
    explanation: "You trade too frequently, likely chasing market noise.",
    suggestion: "Set a hard cap of 5 trades per session to enforce quality over quantity."
  },
  "Early Exit": {
    explanation: "You exit winning positions too early, missing out on major moves.",
    suggestion: "Use trailing stop-losses to let winners run until the trend actually breaks."
  },
  "Holding Losers": {
    explanation: "You hold losing positions significantly longer than winning ones.",
    suggestion: "Enforce strict stop-losses at the time of entry. Never move a stop-loss down."
  },
  "Averaging Down": {
    explanation: "You add more capital to losing trades to lower your cost basis.",
    suggestion: "Avoid adding to underwater positions. Stick to your initial trade plan."
  }
};

const generateInsights = (behaviorOutput) => {
  const { patterns = [], dominantMistake, riskProfile } = behaviorOutput;

  // 1. Process Patterns (Severity & Mapping)
  const enrichedPatterns = patterns.map(p => {
    const map = PATTERN_MAP[p.name] || { explanation: "Unusual activity detected.", suggestion: "Review your trade rationale." };
    
    let severity = "LOW";
    if (p.confidence > 0.7) severity = "HIGH";
    else if (p.confidence >= 0.4) severity = "MEDIUM";

    return {
      ...p,
      explanation: map.explanation,
      suggestion: map.suggestion,
      severity
    };
  });

  // 2. Extract Top Issues
  const topIssues = [...enrichedPatterns]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  // 3. Combined Insights Logic
  const patternNames = patterns.map(p => p.name);
  let combinedInsight = "No critical behavioral combinations detected.";

  if (patternNames.includes("Revenge Trading") && patternNames.includes("Overtrading")) {
    combinedInsight = "You react emotionally and overtrade after losses, which is a high-risk cycle.";
  } else if (patternNames.includes("Early Exit") && patternNames.includes("Holding Losers")) {
    combinedInsight = "You cut profits early but let losses run, creating a negative expectancy.";
  } else if (patternNames.includes("Averaging Down") && patternNames.includes("Holding Losers")) {
    combinedInsight = "You increase exposure to losing trades, risking major capital drawdowns.";
  }

  // 4. Summary Diagnosis
  let summary = "Your trading behavior is currently within disciplined boundaries.";
  if (dominantMistake && dominantMistake !== "None Detected") {
    summary = `The primary drag on your performance is ${dominantMistake.toLowerCase()}, requiring immediate protocol adjustment.`;
  }

  // 5. Risk Narrative
  const riskNarrative = `You operate with a ${riskProfile.riskTolerance.toLowerCase()} risk profile, maintaining a consistency score of ${riskProfile.consistencyScore}% across sessions.`;

  return {
    patterns: enrichedPatterns,
    topIssues,
    combinedInsight,
    summary,
    riskNarrative
  };
};

module.exports = { generateInsights };
