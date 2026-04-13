const { validatePlan, getRiskScore } = require("../services/risk.engine");
const { analyzeBehavior } = require("../services/behavior.engine");
const { SYSTEM_CONFIG } = require("../config/system.config");
const {
  INTELLIGENCE_STATUS,
  createUnavailableStatus,
} = require("../constants/intelligenceStatus");

const mapDecisionVerdictToAuthorityVerdict = (verdict) => {
  if (verdict === "ALLOW") return "BUY";
  if (verdict === "CAUTION") return "WAIT";
  if (verdict === "BLOCK") return "AVOID";
  throw new Error(`ENTRY_ENGINE_DEPENDENCY_CONFUSION: Unsupported verdict ${verdict}`);
};

const evaluateEntryDecision = (input = {}) => {
  if (!input || typeof input !== "object") {
    throw new Error("ENTRY_ENGINE_INVALID_INPUT");
  }

  const cfg = SYSTEM_CONFIG.intelligence.preTrade;
  const plan = input.plan || {};
  const marketContext = input.marketContext || {};
  const behaviorContext = input.behaviorContext || {};
  const side = plan.side || "BUY";

  const behaviorFlags = Array.isArray(behaviorContext.flags) ? behaviorContext.flags : [];
  const hasMarketData = marketContext.status !== INTELLIGENCE_STATUS.UNAVAILABLE;
  const hasBehaviorData = behaviorContext.status !== INTELLIGENCE_STATUS.UNAVAILABLE;
  const behaviorProfile = Array.isArray(behaviorContext.closedTrades)
    ? analyzeBehavior(behaviorContext.closedTrades)
    : createUnavailableStatus("INSUFFICIENT_BEHAVIOR_DATA");

  const reasons = [];
  let rr = 0;
  let planValidation = { isValid: true, rr: 0, errorCode: null };

  if (!hasMarketData || !hasBehaviorData) {
    return {
      verdict: "BLOCK",
      reasons: ["INSUFFICIENT_DATA"],
      riskScore: null,
      baseRiskImpact: null,
      behaviorFlags,
      planValidation,
      rr: null,
      behaviorProfile,
      status: INTELLIGENCE_STATUS.UNAVAILABLE,
      reason: !hasMarketData ? "INSUFFICIENT_MARKET_DATA" : "INSUFFICIENT_BEHAVIOR_DATA",
    };
  }

  if (side === "BUY") {
    planValidation = validatePlan({
      side: "BUY",
      pricePaise: plan.pricePaise,
      stopLossPaise: plan.stopLossPaise,
      targetPricePaise: plan.targetPricePaise,
    });

    if (!planValidation.isValid) {
      return {
        verdict: "BLOCK",
        reasons: [planValidation.errorCode],
        riskScore: null,
        baseRiskImpact: null,
        behaviorFlags,
        planValidation,
        rr: null,
        status: INTELLIGENCE_STATUS.UNAVAILABLE,
        reason: "INVALID_PLAN",
      };
    }
    rr = planValidation.rr || 0;
  }

  let baseRiskImpact = 0;

  if (side === "BUY" && marketContext.consensusVerdict === "AVOID") {
    baseRiskImpact += cfg.avoidConsensusPenalty;
    reasons.push("MARKET_CONSENSUS_AVOID");
  }

  if (marketContext.strategyValid === false) {
    baseRiskImpact += cfg.strategyInvalidPenalty;
    reasons.push("STRATEGY_INVALID");
  }

  if (behaviorFlags.includes("REVENGE_TRADING_RISK")) {
    baseRiskImpact += cfg.revengeFlagPenalty;
    reasons.push("REVENGE_TRADING_RISK");
  }

  if (behaviorFlags.includes("OVERTRADING_RISK")) {
    baseRiskImpact += cfg.revengeFlagPenalty;
    reasons.push("OVERTRADING_RISK");
  }

  if (side === "BUY") {
    const planRiskScore = getRiskScore({
      side: "BUY",
      pricePaise: plan.pricePaise,
      stopLossPaise: plan.stopLossPaise,
      targetPricePaise: plan.targetPricePaise,
    });
    baseRiskImpact += planRiskScore;
    if (planRiskScore > 0) reasons.push("LOW_RR_PENALTY");
  }

  const adaptedHighPenalty = marketContext.adaptedRiskLevel === "HIGH" ? cfg.adaptiveHighPenalty : 0;
  if (adaptedHighPenalty > 0) reasons.push("ADAPTIVE_HIGH_RISK");

  const finalScore = Math.max(0, 100 - baseRiskImpact - adaptedHighPenalty);

  let verdict = "ALLOW";
  if (finalScore < cfg.avoidBoundary) verdict = "BLOCK";
  else if (finalScore < cfg.waitBoundary) verdict = "CAUTION";

  if (verdict === "ALLOW" && marketContext.forceBlock === true) {
    throw new Error("ENTRY_ENGINE_DEPENDENCY_CONFUSION: forceBlock conflicts with ALLOW verdict");
  }

  return {
    verdict,
    reasons,
    riskScore: finalScore,
    baseRiskImpact,
    behaviorFlags,
    planValidation,
    rr,
    behaviorProfile,
    status: INTELLIGENCE_STATUS.VALID,
  };
};

module.exports = {
  evaluateEntryDecision,
  mapDecisionVerdictToAuthorityVerdict,
};
