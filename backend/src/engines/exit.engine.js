const PANIC_EXIT_THRESHOLD_MS = Number(process.env.PANIC_EXIT_THRESHOLD_MS || 10 * 60 * 1000); // 10 min

/**
 * EXIT ENGINE
 *
 * Classifies a closed trade by how it deviated from the original entry plan.
 *
 * exitType enum (canonical):
 *   PANIC          — exit within PANIC_EXIT_THRESHOLD_MS of entry (fear-driven, time-gated)
 *   STOP_LOSS_HIT  — exit price at or below stopLossPaise (disciplined loss)
 *   TARGET_HIT     — exit price at or above targetPricePaise (disciplined profit, alias NORMAL)
 *   EARLY_EXIT     — exit before plan target/stop was reached (early cut on loss, early profit take)
 *   LATE_EXIT      — exit beyond plan target/stop (overhold on profit, held losers past stop)
 *   NORMAL         — exit at exactly the target price (kept for backward compat; same as TARGET_HIT)
 *
 * deviationScore (0–100): how far the exit deviated from the optimal plan exit point.
 *   100 = perfect execution.  0 = maximal deviation.
 */
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

  // PANIC classification: time-based, evaluated first.
  // Requires caller to supply entryTime + exitTime (epoch ms).
  // Does not override SL_HIT — if price hit SL within 10 min the system triggered it,
  // not the user in panic.
  const entryTime = input.entryTime ? Number(input.entryTime) : null;
  const exitTime = input.exitTime ? Number(input.exitTime) : null;
  const holdDurationMs =
    entryTime && exitTime && exitTime > entryTime ? exitTime - entryTime : null;
  const isPanic =
    holdDurationMs !== null &&
    holdDurationMs < PANIC_EXIT_THRESHOLD_MS &&
    // Do not flag panic for a genuine SL_HIT — the system sold, not fear.
    !(stopLossPaise && exitPricePaise <= stopLossPaise);

  let exitType = "NORMAL";
  let deviationScore = 100;
  const notes = [];

  if (stopLossPaise && exitPricePaise <= stopLossPaise) {
    exitType = "STOP_LOSS_HIT";
    deviationScore = 100;
    notes.push("STOPPED_OUT");
  } else if (isPanic) {
    // Panic exit: position liquidated within threshold — classified independently of price.
    exitType = "PANIC";
    // deviationScore: how far through the risk range was the exit?
    // Exiting near entry = low loss but high panic signal.
    // Score represents how much of the planned risk was taken (lower = more panicky).
    if (stopLossPaise) {
      const fullRisk = Math.abs(entryPricePaise - stopLossPaise);
      const actualMove = Math.abs(exitPricePaise - entryPricePaise);
      deviationScore = fullRisk > 0 ? Math.max(0, Math.min(100, Math.round((1 - actualMove / fullRisk) * 100))) : 50;
    } else {
      deviationScore = 50;
    }
    notes.push("PANIC_EXIT");
    if (isProfit) notes.push("EARLY_PROFIT_TAKE");
    if (isLoss) notes.push("EARLY_CUT");
  } else if (isProfit && targetPricePaise && exitPricePaise > targetPricePaise) {
    exitType = "LATE_EXIT";
    const plannedReward = Math.abs(targetPricePaise - entryPricePaise);
    const overshoot = Math.abs(exitPricePaise - targetPricePaise);
    const overshootRatio = plannedReward > 0 ? Math.min(1, overshoot / plannedReward) : 1;
    deviationScore = Math.max(50, Math.round(100 - (overshootRatio * 40)));
    notes.push("OVERHOLD");
  } else if (targetPricePaise && exitPricePaise >= targetPricePaise) {
    exitType = "NORMAL"; // semantically TARGET_HIT; kept as NORMAL for backward compat
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
    const distanceFromStop = Math.abs(exitPricePaise - stopLossPaise);
    const fullRisk = Math.abs(entryPricePaise - stopLossPaise);
    const ratio = fullRisk > 0 ? distanceFromStop / fullRisk : 1;
    deviationScore = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));
    notes.push("EARLY_CUT");
  } else if (isLoss && stopLossPaise && exitPricePaise < stopLossPaise) {
    exitType = "LATE_EXIT";
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
    holdDurationMs,
    isPanic,
  };
};

module.exports = { evaluateExit };
