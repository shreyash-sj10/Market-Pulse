/**
 * Single 0–100 confidence model for intelligence layers.
 * LLM outputs must not invent confidence; callers derive scores from measurable inputs only.
 *
 * confidence ≈ 0.40 * signalStrength + 0.35 * signalAgreement + 0.25 * dataCompleteness
 * Each input is clamped to [0, 1].
 */

const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));

const computeUnifiedConfidence0to100 = ({
  signalStrength = 0,
  signalAgreement = 0,
  dataCompleteness = 0,
} = {}) => {
  const s = clamp01(signalStrength);
  const a = clamp01(signalAgreement);
  const d = clamp01(dataCompleteness);
  const score = 0.4 * s + 0.35 * a + 0.25 * d;
  return Math.round(score * 100);
};

/** Map sentiment magnitude (-10..10) to strength [0,1]. */
const strengthFromSentiment10 = (sentiment) => {
  const v = Math.abs(Number(sentiment) || 0);
  return clamp01(v / 10);
};

module.exports = {
  computeUnifiedConfidence0to100,
  strengthFromSentiment10,
  clamp01,
};
