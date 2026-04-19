/**
 * REFLECTION ENGINE
 * Aggregates deterministic exit analysis from exit.engine.
 */
const { evaluateExit } = require("./exit.engine");

exports.analyzeReflection = (closedTrade) => {
  if (!closedTrade || typeof closedTrade !== "object") {
    throw new Error("INVALID_REFLECTION_INPUT: Input must be a valid ClosedTrade object.");
  }

  const entryPrice = closedTrade.entryPricePaise ?? 0;
  const exitPrice = closedTrade.exitPricePaise ?? 0;
  const stopLossPaise = closedTrade.stopLossPaise ?? 0;
  const targetPricePaise = closedTrade.targetPricePaise ?? 0;

  if (entryPrice === undefined || exitPrice === undefined) {
    throw new Error("INVALID_REFLECTION_INPUT: Critical valuation data missing.");
  }

  const exitAnalysis = evaluateExit({
    entryPlan: {
      entryPricePaise: entryPrice,
      stopLossPaise,
      targetPricePaise,
    },
    exitPricePaise: exitPrice,
    currentPricePaise: closedTrade.currentPricePaise,
    timeHeld: closedTrade.holdTime,
    // Pass timestamps so PANIC classification can fire.
    entryTime: closedTrade.entryTime,
    exitTime: closedTrade.exitTime,
    behaviorContext: { tags: closedTrade.behaviorTags || [] },
  });

  let verdict = "NEUTRAL";
  let executionPattern = "MANUAL_EXIT";
  let deviationScore = exitAnalysis.deviationScore;
  let insight = "Trade executed according to terminal protocol.";
  let improvement = "Maintain current discipline level.";
  const tags = [];

  if (exitAnalysis.exitType === "PANIC") {
    verdict = "POOR_PROCESS";
    executionPattern = "PANIC_EXIT";
    insight = "Position closed within minutes of entry — a panic-driven exit driven by short-term price noise rather than your original thesis.";
    improvement = "Define your stop loss before entering. If price has not reached your SL, the thesis is intact — exit only on thesis break, not fear.";
    tags.push("PANIC_EXIT", "FEAR_PATTERN");
  } else if (exitAnalysis.notes.includes("TARGET_HIT")) {
    verdict = "DISCIPLINED_PROFIT";
    executionPattern = "TARGET_HIT";
    insight = "Position reached the defined target. Protocol fully realized through disciplined execution.";
  } else if (exitAnalysis.notes.includes("STOPPED_OUT")) {
    verdict = "DISCIPLINED_LOSS";
    executionPattern = "STOPPED_OUT";
    insight = "Position liquidated at stop loss. Capital protection successful; protocol preserved.";
  } else if (exitAnalysis.notes.includes("EARLY_PROFIT_TAKE")) {
    verdict = "POOR_PROCESS";
    executionPattern = "EARLY_EXIT";
    insight = "Exited before target hit indicates fear-based decision under uncertainty. Leaving institutional gains on the table.";
    improvement = "Trust the pre-validated plan; avoid manual anxiety-driven exits during volatility.";
    tags.push("EARLY_EXIT", "FEAR_PATTERN");
  } else if (exitAnalysis.notes.includes("EARLY_CUT")) {
    verdict = "DISCIPLINED_LOSS";
    executionPattern = "EARLY_CUT";
    insight = "Defensive exit before stop loss triggered. Active risk mitigation; protocol-aligned behavior.";
    tags.push("EARLY_CUT");
  } else if (exitAnalysis.notes.includes("OVERHOLD")) {
    verdict = "LUCKY_PROFIT";
    executionPattern = "OVERHOLD";
    insight = "Profit target bypassed without plan update suggests greed-based deviation from initial protocol.";
    improvement = "Implement trailing stops if seeking gains beyond initial targets to avoid lucky-outcome bias.";
    tags.push("OVERHOLD", "GREED_PATTERN");
  } else if (exitAnalysis.notes.includes("HOLDING_LOSERS")) {
    verdict = "POOR_PROCESS";
    executionPattern = "HOLDING_LOSERS";
    insight = "Held position beyond stop loss reflects hope-based bias or loss aversion. Capital at risk.";
    improvement = "Enforce stop loss automatically; never override the exit protocol for losing positions.";
    tags.push("HOLDING_LOSER", "HOPE_PATTERN");
  }

  return {
    verdict,
    executionPattern,
    deviationScore,
    insight,
    improvement,
    tags,
  };
};
