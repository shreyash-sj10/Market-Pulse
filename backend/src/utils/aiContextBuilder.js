/**
 * AI CONTEXT BUILDER
 * Compresses raw engine signals into structured reasoning before AI calls.
 * AI must NEVER receive raw engine objects — always compressed context.
 * Deterministic. No AI calls. No side effects.
 */
const { VOCAB } = require("../constants/systemVocabulary");

/**
 * Extracts the top 3 reasons from signal inputs.
 * @param {Object} signals - { marketSignals, behaviorSignals, riskSignals }
 * @returns {string[]}
 */
const extractTopReasons = (signals = {}) => {
  const reasons = [];
  const { marketSignals, behaviorSignals, riskSignals } = signals;

  if (marketSignals?.direction) {
    const aligned = marketSignals.direction === "BUY" ? "bullish" : "bearish";
    reasons.push(`Market is ${aligned} with ${Math.round((marketSignals.confidence || 0) * 100)}% confidence.`);
  }
  if (behaviorSignals?.risk) {
    reasons.push(`${VOCAB.BEHAVIOR} state is ${behaviorSignals.risk.toLowerCase()}.`);
  }
  if (riskSignals?.level) {
    reasons.push(`${VOCAB.RISK} exposure is ${riskSignals.level.toLowerCase()}.`);
  }
  return reasons;
};

/**
 * Identifies contradictions between signals (e.g. bullish market but high behavioral risk).
 * @param {Object} signals
 * @returns {string[]}
 */
const extractConflicts = (signals = {}) => {
  const conflicts = [];
  const { marketSignals, behaviorSignals, riskSignals } = signals;

  if (
    marketSignals?.direction === "BUY" &&
    (behaviorSignals?.risk === "HIGH" || riskSignals?.level === "HIGH")
  ) {
    conflicts.push("Market is bullish but behavioral or risk conditions are elevated — caution advised.");
  }

  if (
    marketSignals?.direction === "SELL" &&
    behaviorSignals?.score > 80
  ) {
    conflicts.push("Bearish market signal but strong discipline score — potential for divergent entry.");
  }

  return conflicts;
};

/**
 * Builds a compressed decision context object for the score explainer.
 * Strips raw messages, timestamps, adaptive noise.
 * @param {Object} input
 * @returns {Object} structured context for AI
 */
const buildDecisionContext = (input = {}) => {
  const { verdict, score, marketSignals, behaviorSignals, riskSignals, behaviorTag } = input;
  const signals = { marketSignals, behaviorSignals, riskSignals };
  return {
    verdict: verdict || "UNKNOWN",
    confidence: typeof score === "number" ? score : 0,
    verdictLabel: VOCAB[`VERDICT_${verdict}`] || verdict,
    reasonChain: extractTopReasons(signals),
    contradictions: extractConflicts(signals),
    behavior: VOCAB.BEHAVIOR_TAGS?.[behaviorTag] || behaviorTag || "None",
  };
};

/**
 * Builds a compressed reflection context for trade review AI.
 * @param {Object} trade
 * @param {Object} reflection - deterministic reflection output
 * @returns {Object}
 */
const buildReflectionContext = (trade = {}, reflection = {}) => {
  return {
    symbol: trade.symbol || "UNKNOWN",
    entryPricePaise: trade.entryPricePaise || 0,
    exitPricePaise: trade.exitPricePaise || 0,
    pnlPct: typeof trade.pnlPct === "number" ? trade.pnlPct : 0,
    outcome: VOCAB.OUTCOME_TAGS?.[reflection.verdict] || reflection.verdict || "UNKNOWN",
    behaviorDeviation: reflection.tags?.length > 0 ? reflection.tags[0] : "NONE",
    deviationScore: reflection.deviationScore || 0,
  };
};

/**
 * Builds a compressed news context for NLP analysis.
 * De-duplicates headlines and limits to 10 most relevant.
 * @param {Array} newsItems
 * @param {string} sector
 * @returns {Object}
 */
const buildNewsContext = (newsItems = [], sector = "General") => {
  const seen = new Set();
  const deduped = newsItems
    .map((n) => (typeof n === "string" ? n : n.title || ""))
    .filter((t) => t && !seen.has(t) && seen.add(t))
    .slice(0, 10);

  return {
    sector,
    headlineCount: deduped.length,
    headlines: deduped,
  };
};

module.exports = {
  buildDecisionContext,
  buildReflectionContext,
  buildNewsContext,
  extractTopReasons,
  extractConflicts,
};
