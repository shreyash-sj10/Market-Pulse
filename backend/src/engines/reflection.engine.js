/**
 * REFLECTION ENGINE
 * Pure deterministic logic to compare execution against original plan.
 */
exports.analyzeReflection = (closedTrade) => {
  if (!closedTrade || typeof closedTrade !== 'object') {
    throw new Error("INVALID_REFLECTION_INPUT: Input must be a valid ClosedTrade object.");
  }

  const entryPrice = closedTrade.entryPricePaise ?? 0;
  const exitPrice = closedTrade.exitPricePaise ?? 0;
  const stopLoss = closedTrade.stopLossPaise ?? 0;
  const targetPrice = closedTrade.targetPricePaise ?? 0;

  if (entryPrice === undefined || exitPrice === undefined) {
    throw new Error("INVALID_REFLECTION_INPUT: Critical price data missing.");
  }



  
  let verdict = "NEUTRAL";
  let executionPattern = "MANUAL_EXIT";
  let deviationScore = 100;
  let insight = "Trade executed according to terminal protocol.";
  let improvement = "Maintain current discipline level.";
  const tags = [];

  const isProfit = exitPrice > entryPrice;
  const isLoss = exitPrice < entryPrice;

  // Pattern Detection Logic
  if (targetPrice && exitPrice >= targetPrice) {
    verdict = "DISCIPLINED_PROFIT";
    executionPattern = "TARGET_HIT";
    deviationScore = 100;
    insight = "Position reached the defined target. Protocol fully realized through disciplined execution.";
  } else if (stopLoss && exitPrice <= stopLoss) {
    verdict = "DISCIPLINED_LOSS";
    executionPattern = "STOPPED_OUT";
    deviationScore = 100;
    insight = "Position liquidated at stop loss. Capital protection successful; protocol preserved.";
  } else if (isProfit && targetPrice && exitPrice < targetPrice) {
    verdict = "POOR_PROCESS";
    executionPattern = "EARLY_EXIT";
    const potential = targetPrice - entryPrice;
    const actual = exitPrice - entryPrice;
    deviationScore = Math.max(0, Math.round((actual / potential) * 100));
    insight = "Exited before target hit → indicates fear-based decision under uncertainty. Leaving institutional gains on the table.";
    improvement = "Trust the AI-vetted strategy; avoid manual anxiety-driven exits during volatility.";
    tags.push("EARLY_EXIT", "FEAR_PATTERN");
  } else if (isLoss && stopLoss && exitPrice > stopLoss) {
    verdict = "DISCIPLINED_LOSS"; // Cutting early is better than holding losers
    executionPattern = "EARLY_CUT";
    deviationScore = 80;
    insight = "Defensive exit before stop loss triggered. Active risk mitigation; protocol-aligned behavior.";
    tags.push("EARLY_CUT");
  } else if (isProfit && targetPrice && exitPrice > targetPrice) {
    verdict = "LUCKY_PROFIT";
    executionPattern = "OVERHOLD";
    deviationScore = 60;
    insight = "Profit target bypassed without plan update → suggests greed-based deviation from initial protocol.";
    improvement = "Implement trailing stops if seeking gains beyond initial targets to avoid lucky-outcome bias.";
    tags.push("OVERHOLD", "GREED_PATTERN");
  } else if (isLoss && stopLoss && exitPrice < stopLoss) {
    verdict = "POOR_PROCESS";
    executionPattern = "HOLDING_LOSERS";
    deviationScore = 20;
    insight = "Held position beyond stop loss → reflects hope-based bias or loss aversion. Capital at risk.";
    improvement = "Enforce stop loss automatically; never override the exit protocol for losing positions.";
    tags.push("HOLDING_LOSER", "HOPE_PATTERN");
  }


  return {
    verdict,
    executionPattern,
    deviationScore,
    insight,
    improvement,
    tags
  };
};
