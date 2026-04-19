const { validatePlan, getRiskScore } = require("../services/risk.engine");
const { analyzeBehavior } = require("../services/behavior.engine");
const { SYSTEM_CONFIG } = require("../config/system.config");
const {
  INTELLIGENCE_STATUS,
  createUnavailableStatus,
} = require("../constants/intelligenceStatus");
const { getSquareoffMinutesIst } = require("../services/marketHours.service");

const mapDecisionVerdictToAuthorityVerdict = (verdict) => {
  if (verdict === "ALLOW") return "BUY";
  if (verdict === "CAUTION") return "WAIT";
  if (verdict === "BLOCK") return "AVOID";
  throw new Error(`ENTRY_ENGINE_DEPENDENCY_CONFUSION: Unsupported verdict ${verdict}`);
};

const clampScore = (n) => Math.max(0, Math.min(100, Number(n)));

const normalizeProductType = (raw) => {
  const v = typeof raw === "string" ? raw.toUpperCase().trim() : "";
  return v === "INTRADAY" ? "INTRADAY" : "DELIVERY";
};

const evaluateEntryDecision = (input = {}) => {
  if (!input || typeof input !== "object") {
    throw new Error("ENTRY_ENGINE_INVALID_INPUT");
  }

  const cfg = SYSTEM_CONFIG.intelligence.preTrade;
  const wCfg = cfg.weightedEntry || {};
  const plan = input.plan || {};
  const marketContext = input.marketContext || {};
  const behaviorContext = input.behaviorContext || {};
  const side = plan.side || "BUY";
  const productType = normalizeProductType(plan.productType);

  const behaviorFlags = Array.isArray(behaviorContext.flags) ? behaviorContext.flags : [];
  const hasMarketData = marketContext.status !== INTELLIGENCE_STATUS.UNAVAILABLE;
  const hasBehaviorData = behaviorContext.status !== INTELLIGENCE_STATUS.UNAVAILABLE;
  const behaviorProfile = Array.isArray(behaviorContext.closedTrades)
    ? analyzeBehavior(behaviorContext.closedTrades)
    : createUnavailableStatus("INSUFFICIENT_BEHAVIOR_DATA");

  const reasons = [];
  let rr = 0;
  let planValidation = { isValid: true, rr: 0, errorCode: null };

  if (!hasBehaviorData) {
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
      reason: "INSUFFICIENT_BEHAVIOR_DATA",
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

  const sc = input.scores;
  const useExplicitScores =
    sc &&
    typeof sc.setup === "number" &&
    typeof sc.market === "number" &&
    typeof sc.behavior === "number" &&
    [sc.setup, sc.market, sc.behavior].every((n) => Number.isFinite(n));

  let setupScore;
  let marketScore;
  let behaviorScore;

  if (useExplicitScores) {
    setupScore = clampScore(sc.setup);
    marketScore = clampScore(sc.market);
    behaviorScore = clampScore(sc.behavior);
  } else {
    if (side === "BUY") {
      const planRisk = getRiskScore({
        side: "BUY",
        pricePaise: plan.pricePaise,
        stopLossPaise: plan.stopLossPaise,
        targetPricePaise: plan.targetPricePaise,
      });
      setupScore = clampScore(100 - planRisk);
      if (planRisk > 0) reasons.push("LOW_RR_PENALTY");
    } else {
      setupScore = 70;
    }

    if (!hasMarketData) {
      marketScore = clampScore(100 - (cfg.noMarketDataPenalty ?? 20));
      reasons.push("MARKET_DATA_UNAVAILABLE");
    } else if (marketContext.consensusVerdict === "AVOID") {
      marketScore = clampScore(cfg.conflictedScore ?? 30);
      reasons.push("MARKET_CONSENSUS_AVOID");
    } else {
      marketScore = clampScore(cfg.alignedScore ?? 95);
    }
    if (marketContext.adaptedRiskLevel === "HIGH") {
      marketScore = clampScore(marketScore - (cfg.adaptiveHighPenalty ?? 10));
      reasons.push("ADAPTIVE_HIGH_RISK");
    }

    behaviorScore = 75;
    if (behaviorProfile?.disciplineScore != null && behaviorProfile.success) {
      behaviorScore = clampScore(behaviorProfile.disciplineScore);
    } else if (behaviorProfile?.reason === "INSUFFICIENT_BEHAVIOR_HISTORY") {
      behaviorScore = 70;
    }

    if (behaviorFlags.includes("REVENGE_TRADING_RISK")) {
      behaviorScore = Math.min(behaviorScore, 35);
      reasons.push("REVENGE_TRADING_RISK");
    }
    if (behaviorFlags.includes("OVERTRADING_RISK")) {
      behaviorScore = Math.min(behaviorScore, 40);
      reasons.push("OVERTRADING_RISK");
    }

    // Intraday-specific behavioral flags — heavier weight on behavior score (intraday weight = 0.4)
    if (behaviorFlags.includes("FOMO_ENTRY")) {
      behaviorScore = clampScore(behaviorScore - 25);
      reasons.push("FOMO_ENTRY");
    }
    if (behaviorFlags.includes("PANIC_EXIT")) {
      behaviorScore = clampScore(behaviorScore - 20);
      reasons.push("PANIC_EXIT_HISTORY");
    }
    if (behaviorFlags.includes("CHASING_PRICE")) {
      // Chasing = market alignment problem more than discipline, so penalize market score too.
      marketScore = clampScore(marketScore - 20);
      behaviorScore = clampScore(behaviorScore - 15);
      reasons.push("CHASING_PRICE");
    }

    // Intraday FOMO gate: if current entry time is in the FOMO window, flag it directly.
    if (productType === "INTRADAY" && input.entryTime) {
      const IST_TZ = "Asia/Kolkata";
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: IST_TZ,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }).formatToParts(new Date(input.entryTime));
      const map = {};
      for (const p of parts) map[p.type] = p.value;
      const entryMinutes = Number(map.hour) * 60 + Number(map.minute);
      const squareoffMinutes = getSquareoffMinutesIst();
      const fomoThreshold =
        squareoffMinutes - (cfg.fomoMinutesBeforeClose ?? 25);
      if (entryMinutes >= fomoThreshold && entryMinutes < squareoffMinutes) {
        behaviorScore = clampScore(behaviorScore - 25);
        reasons.push("INTRADAY_FOMO_WINDOW");
      }
    }

    if (behaviorFlags.includes("REVENGE_TRADING_RISK") && marketContext.consensusVerdict === "AVOID") {
      behaviorScore = Math.min(behaviorScore, wCfg.revengeAvoidBehaviorCap ?? 15);
    }
  }

  const vetoFloor = wCfg.behavioralVetoFloor ?? 20;
  if (behaviorScore < vetoFloor) {
    const w =
      productType === "INTRADAY"
        ? wCfg.weightsIntraday || { setup: 0.4, market: 0.2, behavior: 0.4 }
        : wCfg.weightsDelivery || { setup: 0.4, market: 0.3, behavior: 0.3 };
    const compositeEarly =
      setupScore * w.setup + marketScore * w.market + behaviorScore * w.behavior;
    return {
      verdict: "BLOCK",
      reasons: [...new Set([...reasons, "BEHAVIORAL_VETO"])],
      riskScore: Number(compositeEarly.toFixed(2)),
      baseRiskImpact: Number((100 - compositeEarly).toFixed(2)),
      behaviorFlags,
      planValidation,
      rr,
      behaviorProfile,
      status: INTELLIGENCE_STATUS.VALID,
      weightedEntry: {
        setupScore,
        marketScore,
        behaviorScore,
        composite: Number(compositeEarly.toFixed(2)),
        productType,
        weights: w,
      },
    };
  }

  const w =
    productType === "INTRADAY"
      ? wCfg.weightsIntraday || { setup: 0.4, market: 0.2, behavior: 0.4 }
      : wCfg.weightsDelivery || { setup: 0.4, market: 0.3, behavior: 0.3 };

  const composite = setupScore * w.setup + marketScore * w.market + behaviorScore * w.behavior;
  const roundedComposite = Number(composite.toFixed(2));
  const baseRiskImpact = Number((100 - roundedComposite).toFixed(2));

  let verdict = "ALLOW";
  if (roundedComposite < cfg.avoidBoundary) verdict = "BLOCK";
  else if (roundedComposite < cfg.waitBoundary) verdict = "CAUTION";

  if (
    !useExplicitScores &&
    behaviorFlags.includes("REVENGE_TRADING_RISK") &&
    marketContext.consensusVerdict === "AVOID"
  ) {
    verdict = "BLOCK";
    if (!reasons.includes("REVENGE_TRADING_RISK")) reasons.push("REVENGE_TRADING_RISK");
  }

  if (verdict === "ALLOW" && marketContext.forceBlock === true) {
    throw new Error("ENTRY_ENGINE_DEPENDENCY_CONFUSION: forceBlock conflicts with ALLOW verdict");
  }

  return {
    verdict,
    reasons,
    riskScore: roundedComposite,
    baseRiskImpact,
    behaviorFlags,
    planValidation,
    rr,
    behaviorProfile,
    status: INTELLIGENCE_STATUS.VALID,
    weightedEntry: {
      setupScore,
      marketScore,
      behaviorScore,
      composite: roundedComposite,
      productType,
      weights: w,
    },
  };
};

module.exports = {
  evaluateEntryDecision,
  mapDecisionVerdictToAuthorityVerdict,
};
