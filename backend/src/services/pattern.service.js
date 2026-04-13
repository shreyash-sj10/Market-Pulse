/**
 * PATTERN AGGREGATION SERVICE
 * Aggregates behavioral pattern data from ClosedTrade[] into structured insight.
 * Used by portfolio analytics, dashboard endpoints, and skill engine downstream consumers.
 *
 * Deterministic: same ClosedTrade[] always returns same output.
 * No DB calls. No AI. No randomness.
 *
 * DISTINCT FROM patternInsight.service.js:
 *   - patternInsight.service.js:  generates human-readable narrative coaching from userStats
 *   - pattern.service.js:         aggregates raw tag/pattern frequency from ClosedTrade[]
 */
const { VOCAB } = require("../constants/systemVocabulary");

/**
 * Aggregates behavioral patterns from a list of ClosedTrade objects.
 *
 * @param {Array} closedTrades - ClosedTrade[] (from closedTrade.mapper.js)
 * @returns {{
 *   topMistake: string|null,
 *   recurringTags: string[],
 *   frequencyMap: Record<string, number>,
 *   uniquePatternCount: number,
 *   patternDensity: number,
 *   totalTrades: number,
 *   hasMistakes: boolean
 * }}
 */
const aggregatePatterns = (closedTrades) => {
  const empty = {
    topMistake: null,
    recurringTags: [],
    frequencyMap: {},
    uniquePatternCount: 0,
    patternDensity: 0,
    totalTrades: 0,
    hasMistakes: false,
  };

  if (!Array.isArray(closedTrades) || closedTrades.length === 0) {
    return empty;
  }

  const totalTrades = closedTrades.length;

  // ── 1. Collect all behavior tags from trade documents ─────────────────────
  // Sources: direct behaviorTags[], decisionSnapshot exit executionPattern,
  // and learningOutcome verdict (post-reflection tags).
  const allTags = [];

  closedTrades.forEach(ct => {
    // Source A: explicit behaviorTags array
    if (Array.isArray(ct.behaviorTags)) {
      ct.behaviorTags.forEach(tag => {
        if (tag && typeof tag === "string") allTags.push(tag);
      });
    }

    // Source B: decisionSnapshot exit executionPattern (post-reflection classification)
    const execPattern = ct.decisionSnapshot?.exit?.executionPattern;
    if (execPattern && execPattern !== "MANUAL_EXIT" && execPattern !== "N/A") {
      allTags.push(execPattern);
    }

    // Source C: learningOutcome verdict (only add deviating verdicts, not perfect ones)
    const learningVerdict = ct.learningOutcome?.verdict || ct.decisionSnapshot?.exit?.verdict;
    if (
      learningVerdict &&
      learningVerdict !== "DISCIPLINED_PROFIT" &&
      learningVerdict !== "DISCIPLINED_LOSS" &&
      learningVerdict !== "NEUTRAL"
    ) {
      allTags.push(learningVerdict);
    }
  });

  if (allTags.length === 0) {
    return { ...empty, totalTrades, hasMistakes: false };
  }

  // ── 2. Build frequency map ────────────────────────────────────────────────
  // Deterministic: sort tags alphabetically before counting to ensure stable order.
  const frequencyMap = {};
  allTags.forEach(tag => {
    frequencyMap[tag] = (frequencyMap[tag] || 0) + 1;
  });

  // ── 3. Sort by frequency descending (stable: ties broken alphabetically) ──
  const sortedEntries = Object.entries(frequencyMap).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];   // higher count first
    return a[0].localeCompare(b[0]);           // alphabetical for ties — deterministic
  });

  const topMistake = sortedEntries.length > 0 ? sortedEntries[0][0] : null;
  const uniquePatternCount = sortedEntries.length;

  // ── 4. Recurring tags: appear in > 20% of all trades ─────────────────────
  const recurrenceThreshold = Math.max(1, Math.floor(totalTrades * 0.20));
  const recurringTags = sortedEntries
    .filter(([, count]) => count >= recurrenceThreshold)
    .map(([tag]) => tag);

  // ── 5. Pattern density: total tag occurrences per trade ──────────────────
  const totalTagOccurrences = allTags.length;
  const patternDensity = Number((totalTagOccurrences / totalTrades).toFixed(2));

  return {
    topMistake,
    recurringTags,
    frequencyMap,
    uniquePatternCount,
    patternDensity,
    totalTrades,
    hasMistakes: topMistake !== null,
  };
};

/**
 * Returns an ordered leaderboard of the user's most frequent mistakes,
 * enriched with human-readable labels from systemVocabulary.
 *
 * @param {ReturnType<typeof aggregatePatterns>} aggregated
 * @returns {{ tag: string, label: string, count: number, pct: number }[]}
 */
const rankMistakes = (aggregated) => {
  if (!aggregated || !aggregated.hasMistakes) return [];

  const { frequencyMap, totalTrades } = aggregated;

  return Object.entries(frequencyMap)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([tag, count]) => ({
      tag,
      label: VOCAB.BEHAVIOR_TAGS?.[tag] || VOCAB.OUTCOME_TAGS?.[tag] || tag,
      count,
      pct: Number(((count / totalTrades) * 100).toFixed(1)),
    }));
};

module.exports = { aggregatePatterns, rankMistakes };
