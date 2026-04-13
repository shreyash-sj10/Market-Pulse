const { SYSTEM_CONFIG } = require("../config/system.config");

const MIN_RR = SYSTEM_CONFIG.risk.minRr;
const LOW_RR_THRESHOLD = SYSTEM_CONFIG.intelligence.preTrade.lowRrThreshold;
const LOW_RR_PENALTY = SYSTEM_CONFIG.intelligence.preTrade.lowRrPenalty;

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPaiseInt = (value, fieldName) => {
  const parsed = toNullableNumber(value);
  if (parsed === null) {
    throw new Error(`MISSING_REQUIRED_FIELD:${fieldName}`);
  }
  return Math.round(parsed);
};

const calculateRR = (pricePaise, stopLossPaise, targetPricePaise) => {
  const entry = toNullableNumber(pricePaise);
  const stop = toNullableNumber(stopLossPaise);
  const target = toNullableNumber(targetPricePaise);

  if (!entry || !stop || !target) return null;
  const risk = entry - stop;
  const reward = target - entry;
  if (risk <= 0 || reward <= 0) return null;
  return Number((reward / risk).toFixed(2));
};

const validatePlan = (plan = {}) => {
  const {
    pricePaise,
    stopLossPaise,
    targetPricePaise,
    minRr = MIN_RR,
    side = "BUY",
  } = plan;

  const parsedPricePaise = toNullableNumber(pricePaise);
  const parsedStopLossPaise = toNullableNumber(stopLossPaise);
  const parsedTargetPricePaise = toNullableNumber(targetPricePaise);

  if (side !== "BUY" && side !== "SELL") {
    return { isValid: false, errorCode: "INVALID_SIDE", rr: null };
  }

  if (parsedPricePaise === null) {
    return { isValid: false, errorCode: "MISSING_REQUIRED_FIELD:pricePaise", rr: null };
  }

  if (parsedStopLossPaise === null || parsedTargetPricePaise === null) {
    return { isValid: false, errorCode: "PLAN_REQUIRED", rr: null };
  }

  const finalPricePaise = toPaiseInt(parsedPricePaise, "pricePaise");
  const finalStopLossPaise = toPaiseInt(parsedStopLossPaise, "stopLossPaise");
  const finalTargetPricePaise = toPaiseInt(parsedTargetPricePaise, "targetPricePaise");

  if (side === "BUY") {
    if (finalTargetPricePaise <= finalPricePaise) return { isValid: false, errorCode: "INVALID_TARGET", rr: null };
    if (finalStopLossPaise >= finalPricePaise) return { isValid: false, errorCode: "INVALID_STOPLOSS", rr: null };
  }

  if (side === "SELL") {
    if (finalTargetPricePaise >= finalPricePaise) return { isValid: false, errorCode: "INVALID_TARGET", rr: null };
    if (finalStopLossPaise <= finalPricePaise) return { isValid: false, errorCode: "INVALID_STOPLOSS", rr: null };
  }

  const rr = side === "BUY"
    ? calculateRR(finalPricePaise, finalStopLossPaise, finalTargetPricePaise)
    : calculateRR(finalPricePaise, finalTargetPricePaise, finalStopLossPaise);

  if (!rr || !Number.isFinite(rr) || rr < minRr) {
    return { isValid: false, errorCode: "INVALID_RR", rr: null };
  }

  return { isValid: true, errorCode: null, rr };
};

const getRiskScore = (plan = {}) => {
  const validation = validatePlan({ ...plan, minRr: 0 });
  if (!validation.isValid || !validation.rr) {
    return LOW_RR_PENALTY;
  }
  return validation.rr < LOW_RR_THRESHOLD ? LOW_RR_PENALTY : 0;
};

const computePnlPct = (pnlPaise, costBasisPaise) => {
  if (!costBasisPaise || costBasisPaise <= 0) return 0;
  return Number(((pnlPaise / costBasisPaise) * 100).toFixed(2));
};

module.exports = {
  MIN_RR,
  toNullableNumber,
  calculateRR,
  validatePlan,
  getRiskScore,
  computePnlPct,
};
