const crypto = require("crypto");
const { computeUnifiedConfidence0to100, strengthFromSentiment10, clamp01 } = require("../../utils/unifiedConfidence");

/**
 * Canonical cross-layer digest so market / entry / profile-style views can assert consistency.
 * Pure function — no I/O.
 */
const digestIntelligenceSlices = ({
  ruleVerdict,
  riskScore,
  marketVerdict,
  marketConfidence,
  marketAlignment,
  sentiment10,
  signalCount,
  avgSignalConfidence,
}) => {
  const signalStrength = strengthFromSentiment10(sentiment10);
  const signalAgreement =
    !Number.isFinite(signalCount) || signalCount < 2
      ? 0.42
      : clamp01(0.55 + Math.min(signalCount, 8) * 0.05);
  const dataCompleteness = clamp01(
    (Number.isFinite(avgSignalConfidence) ? avgSignalConfidence / 100 : 0) * 0.6 +
      (marketVerdict ? 0.25 : 0) +
      (Number.isFinite(riskScore) ? 0.15 : 0)
  );
  const unifiedConfidence = computeUnifiedConfidence0to100({
    signalStrength,
    signalAgreement,
    dataCompleteness,
  });

  const canonical = {
    v: ruleVerdict ?? null,
    r: riskScore === null || riskScore === undefined ? null : Math.round(Number(riskScore)),
    mv: marketVerdict ?? null,
    mc: marketConfidence === null || marketConfidence === undefined ? null : Math.round(Number(marketConfidence)),
    al: marketAlignment ?? null,
    uc: unifiedConfidence,
  };

  const hash = crypto.createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
  return { canonical, hash };
};

module.exports = { digestIntelligenceSlices };
