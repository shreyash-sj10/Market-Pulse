function deriveVerdict(trade, mistake) {
  if (mistake === "NONE" && trade?.pnlPct > 0) return "GOOD";
  if (trade?.pnlPct < 0 && mistake !== "NONE") return "BAD";
  return "MIXED";
}

function buildDeterministicInsight(mistake, trade) {
  switch (mistake) {
    case "EARLY_EXIT":
      return "You exited before your planned target.";
    case "REVENGE_TRADING":
      return "You entered a trade too soon after a loss.";
    case "OVERTRADING":
      return "You executed too many trades in a short period.";
    case "HOLDING_LOSERS":
    case "STOPLOSS_BROKEN":
      return "You held onto a losing position beyond your planned stop-loss.";
    case "OVERHOLD":
    case "LATE_EXIT":
      return "You held the trade past your planned target price.";
    case "NONE":
      return "You executed the trade perfectly according to your plan.";
    default:
      return "Your trade followed a mixed execution pattern.";
  }
}

function buildCorrection(mistake) {
  switch (mistake) {
    case "EARLY_EXIT":
      return "Hold trades until target or stop-loss.";
    case "REVENGE_TRADING":
      return "Wait before entering another trade after a loss.";
    case "OVERTRADING":
      return "Reduce your trade frequency and stick to high-quality setups.";
    case "HOLDING_LOSERS":
    case "STOPLOSS_BROKEN":
      return "Respect your stop-loss rigidly to preserve capital.";
    case "OVERHOLD":
    case "LATE_EXIT":
      return "Take profits at your planned target instead of hoping for more.";
    case "NONE":
      return "Maintain this discipline on the next trade.";
    default:
      return "Follow your trading plan strictly.";
  }
}

function computeConfidence(reflection, behavior) {
  let score = 0.5;

  if (reflection?.confidence) score += reflection.confidence * 0.3;
  if (behavior?.confidence) score += behavior.confidence * 0.2;

  return Math.min(score, 1);
}

function buildLearningSurface({
  closedTrade,
  reflection,
  behavior,
  mistakeAnalysis,
  aiSummary
}) {
  const primaryMistake =
    mistakeAnalysis?.primaryMistake ||
    reflection?.mistakeTag ||
    "UNKNOWN";

  const verdict = deriveVerdict(closedTrade, primaryMistake);

  const insight =
    aiSummary?.insight ||
    aiSummary?.summary ||
    buildDeterministicInsight(primaryMistake, closedTrade);

  const correction =
    aiSummary?.correction ||
    aiSummary?.lesson ||
    buildCorrection(primaryMistake);

  return {
    verdict,
    primaryMistake,
    insight,
    correction,
    confidence: computeConfidence(reflection, behavior),
    tags: [...(behavior?.tags || []), primaryMistake],
    supportingData: {
      pnlPct: closedTrade?.pnlPct || 0,
      deviationScore: reflection?.deviationScore || 0
    }
  };
}

module.exports = {
  buildLearningSurface,
  deriveVerdict,
  buildDeterministicInsight,
  buildCorrection,
  computeConfidence
};
