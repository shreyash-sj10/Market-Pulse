/**
 * PATTERN INSIGHT SERVICE
 * Converts raw behavioral pattern counts into meaningful, actionable narrative insights.
 * Deterministic — NO AI calls.
 * Used by portfolio analytics and journal endpoints.
 */
const { VOCAB } = require("../constants/systemVocabulary");
const { translateTag } = require("../utils/behaviorTranslator");

/**
 * Derives the dominant mistake pattern and quantifies its impact.
 * @param {Object} userStats
 * @param {string[]} userStats.tags - behavioral tags across all trades
 * @param {number} userStats.totalTrades
 * @param {number} userStats.winRate - 0-100
 * @param {number} userStats.avgPnlPct - average PnL per trade
 * @param {number} userStats.disciplineScore - 0-100
 * @returns {{ summary, impact, recommendation, dominantTag, frequency }}
 */
const generatePatternInsight = (userStats = {}) => {
  const { tags = [], totalTrades = 0, winRate = 0, avgPnlPct = 0, disciplineScore = 100 } = userStats;

  if (totalTrades === 0 || tags.length === 0) {
    return {
      summary: "No trade history available yet.",
      impact: null,
      recommendation: "Complete at least 5 trades to unlock behavioral pattern analysis.",
      dominantTag: null,
      frequency: 0,
    };
  }

  // Count tag frequencies
  const freq = {};
  tags.forEach((t) => { freq[t] = (freq[t] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const [dominantTag, dominantCount] = sorted[0] || ["NONE", 0];
  const frequencyPct = totalTrades > 0 ? Math.round((dominantCount / totalTrades) * 100) : 0;

  const behavior = translateTag(dominantTag);
  const hasCoherentMistake = dominantTag !== "NONE" && dominantTag !== "UNKNOWN";

  if (!hasCoherentMistake) {
    return {
      summary: `${VOCAB.BEHAVIOR} score is strong at ${disciplineScore}/100 across ${totalTrades} trades.`,
      impact: winRate >= 50 ? `Win rate ${winRate}% is above threshold.` : null,
      recommendation: "Maintain current process. Focus on trade selection quality.",
      dominantTag: null,
      frequency: 0,
    };
  }

  // Pattern-specific narrative generation
  let summary, impact, recommendation;

  if (dominantTag === "EARLY_EXIT") {
    summary = `You frequently exit winners early. This limits profit more than your losses.`;
    impact = `${VOCAB.MISTAKE} appears in ~${frequencyPct}% of trades. Avg PnL is ${avgPnlPct.toFixed(1)}% — estimated upside lost per trade: significant.`;
    recommendation = "Set a hard rule: never exit before 50% of target is reached. Use partial exits instead.";
  } else if (dominantTag === "REVENGE_TRADING_RISK" || dominantTag === "REVENGE_TRADING") {
    summary = `Reactive entries after losses are compressing your win rate.`;
    impact = `${frequencyPct}% of your trades show reactive behavior. These trades underperform average by a significant margin.`;
    recommendation = "Implement a mandatory 30-minute cooldown after any loss before re-evaluating.";
  } else if (dominantTag === "FOMO") {
    summary = `You consistently enter after the optimal entry has passed.`;
    impact = `FOMO entries typically have poor R:R. ${frequencyPct}% of trades affected.`;
    recommendation = "If price has already moved >1.5% from the setup zone, skip. The next setup is always coming.";
  } else if (dominantTag === "STOP_LOSS_SKIP") {
    summary = `Missing stop-losses is your highest-risk pattern. One runaway trade can erase weeks of gains.`;
    impact = `${frequencyPct}% of trades lacked a defined stop. This is a critical ${VOCAB.RISK} failure.`;
    recommendation = "No stop = no trade. Enforce this as a system rule, not a preference.";
  } else {
    summary = `${behavior.label} is appearing in ${frequencyPct}% of your trades.`;
    impact = behavior.explanation;
    recommendation = behavior.correction || "Review your pre-trade checklist to address this pattern.";
  }

  return {
    summary,
    impact,
    recommendation,
    dominantTag,
    frequency: frequencyPct,
  };
};

module.exports = { generatePatternInsight };
