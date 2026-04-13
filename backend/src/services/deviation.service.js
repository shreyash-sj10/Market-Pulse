/**
 * DEVIATION CLASSIFICATION SERVICE
 * Standalone classifier wrapping exit.engine.js into a clean, named API.
 * Compares planned trade parameters (SL, Target) against actual exit price.
 *
 * Returns structured classification with human-readable verdict.
 * Deterministic: same input always returns same output.
 * No DB calls. No AI. Pure logic.
 */
const { evaluateExit } = require("../engines/exit.engine");

/**
 * Verdict constants — single source of truth.
 * Consumers must import these rather than string-matching.
 */
const DEVIATION_VERDICTS = Object.freeze({
  FOLLOWED_PLAN:    "FOLLOWED_PLAN",
  EARLY_EXIT:       "EARLY_EXIT",
  LATE_EXIT:        "LATE_EXIT",
  STOPLOSS_BROKEN:  "STOPLOSS_BROKEN",
  NO_PLAN:          "NO_PLAN",          // No SL or target provided
  BREAKEVEN:        "BREAKEVEN",        // Exit exactly at entry — neither profit nor loss
});

/**
 * Classifies the deviation between planned and actual exit for a single trade.
 *
 * @param {Object} trade - requires: entryPricePaise, exitPricePaise, stopLossPaise?, targetPricePaise?
 * @returns {{
 *   verdict: string,
 *   exitNote: string,
 *   deviationScore: number,
 *   exitType: string,
 *   details: Object
 * }}
 */
const classifyDeviation = (trade) => {
  if (!trade || typeof trade !== "object") {
    throw new Error("DEVIATION_CLASSIFICATION_ERROR: trade input is required.");
  }

  const entryPricePaise  = Number(trade.entryPricePaise  || trade.pricePaise || 0);
  const exitPricePaise   = Number(trade.exitPricePaise   || 0);
  const stopLossPaise    = Number(trade.stopLossPaise    || 0);
  const targetPricePaise = Number(trade.targetPricePaise || 0);

  if (!Number.isFinite(entryPricePaise) || entryPricePaise === 0) {
    throw new Error("DEVIATION_CLASSIFICATION_ERROR: entryPricePaise is required and must be non-zero.");
  }
  if (!Number.isFinite(exitPricePaise) || exitPricePaise === 0) {
    throw new Error("DEVIATION_CLASSIFICATION_ERROR: exitPricePaise is required and must be non-zero.");
  }

  // Breakeven — exit exactly at entry price
  if (exitPricePaise === entryPricePaise) {
    return {
      verdict: DEVIATION_VERDICTS.BREAKEVEN,
      exitNote: "BREAKEVEN",
      deviationScore: 100,
      exitType: "NORMAL",
      details: { entryPricePaise, exitPricePaise, stopLossPaise, targetPricePaise },
    };
  }

  // No plan at all — cannot classify against it
  if (stopLossPaise === 0 && targetPricePaise === 0) {
    return {
      verdict: DEVIATION_VERDICTS.NO_PLAN,
      exitNote: "NO_PLAN",
      deviationScore: 50, // Neutral — no plan to compare against
      exitType: "NORMAL",
      details: { entryPricePaise, exitPricePaise, stopLossPaise, targetPricePaise },
    };
  }

  // Delegate to exit engine for authoritative classification
  const exitResult = evaluateExit({
    entryPlan: { entryPricePaise, stopLossPaise, targetPricePaise },
    exitPricePaise,
  });

  const exitNote = exitResult.notes[0] || "NORMAL";
  const { exitType, deviationScore } = exitResult;

  // Map exit engine notes → clean deviation verdict
  let verdict;
  switch (exitNote) {
    case "STOPPED_OUT":
    case "TARGET_HIT":
      verdict = DEVIATION_VERDICTS.FOLLOWED_PLAN;
      break;
    case "EARLY_PROFIT_TAKE":
    case "EARLY_CUT":
      verdict = DEVIATION_VERDICTS.EARLY_EXIT;
      break;
    case "OVERHOLD":
      verdict = DEVIATION_VERDICTS.LATE_EXIT;
      break;
    case "HOLDING_LOSERS":
      verdict = DEVIATION_VERDICTS.STOPLOSS_BROKEN;
      break;
    default:
      // No SL/target matched — exit was somewhere between plan markers
      verdict = DEVIATION_VERDICTS.FOLLOWED_PLAN;
  }

  return {
    verdict,
    exitNote,
    deviationScore,
    exitType,
    details: { entryPricePaise, exitPricePaise, stopLossPaise, targetPricePaise },
  };
};

module.exports = { classifyDeviation, DEVIATION_VERDICTS };
