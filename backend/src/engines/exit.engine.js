const evaluateExit = (input = {}) => {
  if (!input || typeof input !== "object") {
    throw new Error("INVALID_EXIT_INPUT");
  }

  const entryPlan = input.entryPlan || {};
  const entryPricePaise = Number(entryPlan.entryPricePaise);
  const exitPricePaise = Number(input.exitPricePaise);

  if (!Number.isFinite(entryPricePaise) || !Number.isFinite(exitPricePaise)) {
    throw new Error("INVALID_EXIT_INPUT: entry/exit prices are required");
  }

  const stopLossPaise = Number(entryPlan.stopLossPaise || 0);
  const targetPricePaise = Number(entryPlan.targetPricePaise || 0);
  const isProfit = exitPricePaise > entryPricePaise;
  const isLoss = exitPricePaise < entryPricePaise;

  let exitType = "NORMAL";
  let deviationScore = 100;
  const notes = [];

  if (stopLossPaise && exitPricePaise <= stopLossPaise) {
    exitType = "STOP_LOSS_HIT";
    deviationScore = 100;
    notes.push("STOPPED_OUT");
  } else if (isProfit && targetPricePaise && exitPricePaise > targetPricePaise) {
    exitType = "LATE_EXIT";
    deviationScore = 60;
    notes.push("OVERHOLD");
  } else if (targetPricePaise && exitPricePaise >= targetPricePaise) {
    exitType = "NORMAL";
    deviationScore = 100;
    notes.push("TARGET_HIT");
  } else if (isProfit && targetPricePaise && exitPricePaise < targetPricePaise) {
    exitType = "EARLY_EXIT";
    const potential = targetPricePaise - entryPricePaise;
    const actual = exitPricePaise - entryPricePaise;
    deviationScore = potential > 0 ? Math.max(0, Math.round((actual / potential) * 100)) : 0;
    notes.push("EARLY_PROFIT_TAKE");
  } else if (isLoss && stopLossPaise && exitPricePaise > stopLossPaise) {
    exitType = "EARLY_EXIT";
    deviationScore = 80;
    notes.push("EARLY_CUT");
  } else if (isLoss && stopLossPaise && exitPricePaise < stopLossPaise) {
    exitType = "LATE_EXIT";
    deviationScore = 20;
    notes.push("HOLDING_LOSERS");
  }

  return {
    exitType,
    deviationScore,
    notes,
  };
};

module.exports = { evaluateExit };
