/**
 * AI OUTPUT NORMALIZER
 * Maps raw, heterogeneous AI responses to a stable internal shape.
 * NEVER flattens structured data (arrays must stay arrays).
 * NEVER returns undefined — all fields have safe defaults.
 */
const normalizeAIOutput = (raw) => {
  if (!raw || raw.status === "UNAVAILABLE") {
    return null;
  }

  // PHASE 8 FIX: Keep drivers as array — never collapse to string.
  // keyFactors priority: explicit keyFactors → drivers array → keywords → []
  const keyFactors = Array.isArray(raw.keyFactors)
    ? raw.keyFactors
    : Array.isArray(raw.drivers)
      ? raw.drivers
      : Array.isArray(raw.keywords)
        ? raw.keywords
        : [];

  // Summary: use explicit summary, then signal/strategy/finalCall/nuance.
  // NEVER join structured arrays — that destroys meaning.
  const summary =
    raw.summary ||
    raw.signal ||
    raw.finalCall ||
    raw.nuance ||
    "";

  return {
    summary,
    keyFactors,
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    tag: raw.tag || raw.keyRisk || (typeof raw.sentimentScore !== "undefined" ? String(raw.sentimentScore) : "UNKNOWN"),
    explanation: raw.explanation || raw.analysis || raw.reasoning || raw.behaviorAnalysis || "",
    lesson: raw.lesson || "",
    improvement: raw.improvement || "",
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5,
    strategyTag: raw.strategy || raw.tag || "UNKNOWN",
  };
};

module.exports = { normalizeAIOutput };
