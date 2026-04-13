/**
 * LESSON GENERATOR SERVICE
 * Produces exactly ONE actionable lesson per closed trade.
 * Deterministic — NO AI calls. Based on reflection + behavior data.
 * Attached to trade document after reflectionWorker completes.
 */
const { translateTag } = require("../utils/behaviorTranslator");
const { VOCAB } = require("../constants/systemVocabulary");

// Classification: which deviations matter most (ordered priority)
const LESSON_PRIORITY = [
  "STOP_LOSS_SKIP",
  "OVERLEVERAGED",
  "REVENGE_TRADING_RISK",
  "REVENGE_TRADING",
  "FOMO",
  "OVERTRADING",
  "LATE_ENTRY",
  "EARLY_EXIT",
];

/**
 * Generates exactly one structured lesson per trade.
 * @param {Object} trade - normalized trade document
 * @param {Object} reflection - output from analyzeReflection()
 * @returns {{ title: string, insight: string, correction: string, priority: "HIGH"|"MEDIUM"|"LOW" }}
 */
const generateLesson = (trade = {}, reflection = {}) => {
  const tags = reflection.tags || [];
  const verdict = reflection.verdict || "UNKNOWN";
  const pnlPct = typeof trade.pnlPct === "number" ? trade.pnlPct : 0;
  const deviationScore = reflection.deviationScore || 0;

  // Find highest-priority tag from this trade
  const topTag = LESSON_PRIORITY.find((t) => tags.includes(t)) || tags[0] || null;

  if (topTag) {
    const behavior = translateTag(topTag);
    return {
      title: `${VOCAB.MISTAKE}: ${behavior.label}`,
      insight: behavior.explanation,
      correction: behavior.correction || "Review your pre-trade checklist before next entry.",
      priority: deviationScore > 30 ? "HIGH" : "MEDIUM",
      tag: topTag,
    };
  }

  // No behavioral deviation — lesson based on trade outcome
  if (verdict === "DISCIPLINED_LOSS") {
    return {
      title: `${VOCAB.GOOD_TRADE}: Disciplined Stop Respected`,
      insight: `You took a loss of ${Math.abs(pnlPct).toFixed(1)}% but followed your plan exactly. This is correct process.`,
      correction: "Continue executing your plan. Disciplined losses compound into long-term edge.",
      priority: "LOW",
      tag: null,
    };
  }

  if (verdict === "LUCKY_PROFIT") {
    return {
      title: `${VOCAB.BAD_TRADE}: Process Failure Despite Profit`,
      insight: `This trade was profitable (${pnlPct.toFixed(1)}%) but the process was flawed. Profitable bad trades are dangerous — they reinforce poor habits.`,
      correction: "Audit your entry and sizing. Do not repeat this process even if it worked.",
      priority: "HIGH",
      tag: null,
    };
  }

  if (verdict === "VALID_EXECUTION") {
    return {
      title: `${VOCAB.GOOD_TRADE}: Execution Aligned with Plan`,
      insight: `Trade closed ${pnlPct >= 0 ? "in profit" : "at a small loss"} with disciplined execution. No deviations detected.`,
      correction: "Repeat the same process. Document what made this setup valid.",
      priority: "LOW",
      tag: null,
    };
  }

  // Fallback
  return {
    title: "Trade Reviewed",
    insight: reflection.insight || "Trade archived. No dominant pattern detected.",
    correction: "Continue logging trades. Patterns emerge over time.",
    priority: "LOW",
    tag: null,
  };
};

module.exports = { generateLesson };
