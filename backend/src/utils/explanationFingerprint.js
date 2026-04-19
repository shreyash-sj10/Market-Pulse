const crypto = require("crypto");

/**
 * Stable JSON for hashing — sorted keys, rounded numbers, no undefined.
 */
const stableSerialize = (value) => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(Math.round(value * 1000) / 1000);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableSerialize(value[k])).join(",")}}`;
};

/**
 * Phase 3: content-address decisionSignals + behavior slice for explanation cache / replay.
 */
const buildExplanationFingerprint = (decisionInput = {}) => {
  const {
    verdict,
    score,
    marketSignals,
    behaviorSignals,
    riskSignals,
    behaviorTag,
    marketAlignment,
    ruleVerdict,
  } = decisionInput;

  return stableSerialize({
    verdict: verdict ?? null,
    score: typeof score === "number" ? score : score ?? null,
    marketSignals: marketSignals ?? null,
    behaviorSignals: behaviorSignals ?? null,
    riskSignals: riskSignals ?? null,
    behaviorTag: behaviorTag ?? null,
    marketAlignment: marketAlignment ?? null,
    ruleVerdict: ruleVerdict ?? verdict ?? null,
  });
};

const sha256Hex = (str) => crypto.createHash("sha256").update(str, "utf8").digest("hex");

module.exports = {
  buildExplanationFingerprint,
  sha256Hex,
  stableSerialize,
};
