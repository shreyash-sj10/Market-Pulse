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
    // Proportional: how far beyond target relative to planned reward.
    // Slightly past target = score ~85. Far past target = score ~60.
    const plannedReward = Math.abs(targetPricePaise - entryPricePaise);
    const overshoot = Math.abs(exitPricePaise - targetPricePaise);
    const overshootRatio = plannedReward > 0 ? Math.min(1, overshoot / plannedReward) : 1;
    deviationScore = Math.max(50, Math.round(100 - (overshootRatio * 40)));
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
    // How far was the exit from the stop, as a fraction of full risk distance
    // Closer to stop = low deviation (score near 100). Far from stop = high deviation (score near 0).
    const distanceFromStop = Math.abs(exitPricePaise - stopLossPaise);
    const fullRisk = Math.abs(entryPricePaise - stopLossPaise);
    const ratio = fullRisk > 0 ? distanceFromStop / fullRisk : 1;
    // (1 - ratio): exit AT stop → ratio=0 → score=100 (perfect early cut)
    //              exit near entry → ratio=1 → score=0 (large unnecessary deviation)
    deviationScore = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));
    notes.push("EARLY_CUT");
  } else if (isLoss && stopLossPaise && exitPricePaise < stopLossPaise) {
    exitType = "LATE_EXIT";
    // Proportional: how far below the stop relative to full risk.
    // Exited at stop → score ~100 (but this branch is below stop, so minimum deviation).
    // Far below stop → score approaches 0.
    const distanceBeyondStop = Math.abs(exitPricePaise - stopLossPaise);
    const fullRisk = Math.abs(entryPricePaise - stopLossPaise);
    const normalizedOverrun = fullRisk > 0 ? Math.min(1, distanceBeyondStop / fullRisk) : 1;
    deviationScore = Math.max(0, Math.round((1 - normalizedOverrun) * 100));
    notes.push("HOLDING_LOSERS");
  }

  return {
    exitType,
    deviationScore,
    notes,
  };
};

module.exports = { evaluateExit };
