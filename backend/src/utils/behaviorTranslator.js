/**
 * BEHAVIOR TRANSLATOR (Human-Readable Layer)
 * Converts technical system tags into plain-language explanations.
 * Used by AI layer, reflection worker, and response formatters.
 * NO AI calls — fully deterministic.
 */
const { VOCAB } = require("../constants/systemVocabulary");

const BEHAVIOR_EXPLANATIONS = {
  REVENGE_TRADING_RISK: {
    label: VOCAB.BEHAVIOR_TAGS.REVENGE_TRADING_RISK,
    explanation: "You entered quickly after a recent loss, likely trying to recover. This is reactive — not strategic.",
    correction: "Wait at least 30 minutes after a loss before considering your next trade.",
  },
  REVENGE_TRADING: {
    label: VOCAB.BEHAVIOR_TAGS.REVENGE_TRADING,
    explanation: "You entered quickly after a recent loss, likely trying to recover. This is reactive — not strategic.",
    correction: "Wait at least 30 minutes after a loss before considering your next trade.",
  },
  FOMO: {
    label: VOCAB.BEHAVIOR_TAGS.FOMO,
    explanation: "You entered after a significant price move, fearing you'd miss the continued rally.",
    correction: "Entries after large moves carry poor risk-reward. Wait for a pullback or skip.",
  },
  EARLY_EXIT: {
    label: VOCAB.BEHAVIOR_TAGS.EARLY_EXIT,
    explanation: "You exited before your target was reached, cutting a valid trade short.",
    correction: "Trust your pre-defined target. Move your stop to breakeven if nervous, but hold the trade.",
  },
  LATE_ENTRY: {
    label: VOCAB.BEHAVIOR_TAGS.LATE_ENTRY,
    explanation: "You entered late into a move, reducing your reward-to-risk significantly.",
    correction: "Enter closer to the planned setup zone or skip until the next valid opportunity.",
  },
  OVERTRADING: {
    label: VOCAB.BEHAVIOR_TAGS.OVERTRADING,
    explanation: "You placed too many trades in a short window, diluting focus and increasing noise exposure.",
    correction: "Set a daily trade limit (e.g., 2–3 max). Quality over quantity.",
  },
  OVERLEVERAGED: {
    label: VOCAB.BEHAVIOR_TAGS.OVERLEVERAGED,
    explanation: "Position size exceeded safe limits relative to your account and stop distance.",
    correction: "Keep risk per trade to 1–2% of capital. Reduce size before recalibrating.",
  },
  STOP_LOSS_SKIP: {
    label: VOCAB.BEHAVIOR_TAGS.STOP_LOSS_SKIP,
    explanation: "You traded without a defined stop-loss, exposing yourself to unlimited downside.",
    correction: "Always define a stop before entry. No stop = no trade.",
  },
  NONE: {
    label: VOCAB.BEHAVIOR_TAGS.NONE,
    explanation: "No behavioral deviations detected. Execution was disciplined.",
    correction: null,
  },
  UNKNOWN: {
    label: VOCAB.BEHAVIOR_TAGS.UNKNOWN,
    explanation: "No behavioral pattern could be identified for this trade.",
    correction: null,
  },
};

/**
 * Translates a single behavior tag into human-readable insight.
 * @param {string} tag
 * @returns {{ label, explanation, correction }}
 */
const translateTag = (tag) => {
  return (
    BEHAVIOR_EXPLANATIONS[tag] || {
      label: tag,
      explanation: `A deviation labeled "${tag}" was recorded. Review your trade process.`,
      correction: "Consult your trade journal for context.",
    }
  );
};

/**
 * Translates an array of tags into an ordered insight array.
 * @param {string[]} tags
 * @returns {{ label, explanation, correction }[]}
 */
const translateTags = (tags) => {
  if (!Array.isArray(tags) || tags.length === 0) return [translateTag("NONE")];
  return tags.filter(Boolean).map(translateTag);
};

module.exports = { translateTag, translateTags };
