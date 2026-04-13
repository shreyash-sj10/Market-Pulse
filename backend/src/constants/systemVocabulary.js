/**
 * SYSTEM VOCABULARY CONSTANTS
 * Enforces consistent human-readable language across all AI outputs.
 * AI prompts and translators MUST reference these terms only.
 */
const VOCAB = {
  // Core trade concepts
  RISK: "Risk",
  BEHAVIOR: "Discipline",
  MISTAKE: "Deviation",
  GOOD_TRADE: "Valid Execution",
  BAD_TRADE: "Process Failure",
  SIGNAL: "Signal",
  VERDICT: "Decision",
  ENTRY: "Entry",
  EXIT: "Exit",

  // Verdict labels
  VERDICT_BUY: "Proceed",
  VERDICT_WAIT: "Hold",
  VERDICT_AVOID: "Decline",

  // Confidence language
  HIGH_CONFIDENCE: "strong alignment",
  LOW_CONFIDENCE: "weak alignment",
  CONFLICTED: "contradictory signals",

  // Behavior pattern labels (human-readable)
  BEHAVIOR_TAGS: {
    REVENGE_TRADING_RISK: "Reactive Entry",
    REVENGE_TRADING:      "Reactive Entry",
    FOMO:                 "Fear of Missing Out",
    EARLY_EXIT:           "Premature Exit",
    LATE_ENTRY:           "Delayed Entry",
    OVERTRADING:          "Overtrading",
    OVERLEVERAGED:        "Excessive Size",
    STOP_LOSS_SKIP:       "Missing Stop-Loss",
    NONE:                 "Disciplined",
    UNKNOWN:              "Unclassified",
  },

  // Outcome verdict labels
  OUTCOME_TAGS: {
    DISCIPLINED_LOSS:   "Disciplined Loss",
    LUCKY_PROFIT:       "Undisciplined Win",
    VALID_EXECUTION:    "Valid Execution",
    PROCESS_FAILURE:    "Process Failure",
  },
};

module.exports = { VOCAB };
