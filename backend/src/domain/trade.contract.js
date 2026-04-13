const VALID_TRADE_TYPES = new Set(["BUY", "SELL"]);
const { toNullableNumber, calculateRR } = require("../services/risk.engine");

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
};

const normalizeTrade = (rawTrade) => {
  if (!rawTrade) return null;

  const raw = typeof rawTrade.toObject === "function" ? rawTrade.toObject() : rawTrade;

  const type = raw.type;

  if (!VALID_TRADE_TYPES.has(type)) {
    throw new Error(`INVALID_TRADE_TYPE: ${type}`);
  }

  const pricePaise = Math.round(toNullableNumber(raw.pricePaise) || 0);
  const stopLossPaise = toNullableNumber(raw.stopLossPaise);
  const targetPricePaise = toNullableNumber(raw.targetPricePaise);
  const rr = toNullableNumber(raw.rr) ?? (type === "BUY" ? calculateRR(pricePaise, stopLossPaise, targetPricePaise) : null);

  const decisionVerdict =
    raw.finalTradeCall?.finalCall ||
    raw.learningOutcome?.verdict ||
    raw.intelligenceTimeline?.preTrade?.verdict?.finalCall ||
    null;

  const decisionScore =
    toNullableNumber(raw.analysis?.riskScore) ??
    toNullableNumber(raw.intelligenceTimeline?.preTrade?.risk?.score) ??
    toNullableNumber(raw.finalTradeCall?.confidence) ??
    null;

  return {
    id: toId(raw._id || raw.id),
    userId: toId(raw.userId || raw.user),
    symbol: raw.symbol || null,
    type,
    status: raw.status || "EXECUTED",
    reflectionStatus: raw.reflectionStatus || (raw.type === "SELL" && raw.status === "EXECUTED_PENDING_REFLECTION" ? "PENDING" : (raw.type === "SELL" ? "DONE" : null)),
    queuedAt: raw.queuedAt || null,
    executionTime: raw.executionTime || null,
    quantity: toNullableNumber(raw.quantity) ?? 0,
    pricePaise,
    totalValuePaise: toNullableNumber(raw.totalValuePaise),
    stopLossPaise,
    targetPricePaise,
    rr,
    intent: raw.intent || raw.parsedIntent?.strategy || raw.rawIntent || null,
    reasoning: raw.reasoning || raw.userThinking || raw.reason || null,
    decision: {
      verdict: decisionVerdict,
      score: decisionScore,
      pillars: raw.intelligenceTimeline?.preTrade?.pillars || raw.decision?.pillars || {},
    },
    openedAt: raw.openedAt || raw.entryTrade?.createdAt || (type === "BUY" ? raw.createdAt : null) || null,
    closedAt: raw.closedAt || (type === "SELL" ? raw.createdAt : null) || null,
    pnlPaise: toNullableNumber(raw.pnlPaise),
    pnlPct: toNullableNumber(raw.pnlPct),
    analysis: raw.analysis || null,
    manualTags: Array.isArray(raw.manualTags) ? raw.manualTags : [],
    parsedIntent: raw.parsedIntent || null,
    missedOpportunity: raw.missedOpportunity || null,
    entryTradeId: toId(raw.entryTradeId || raw.entryTrade),
    entryPlan: raw.entryPlan || null,
    decisionSnapshot: raw.decisionSnapshot || null,
    learningOutcome: raw.learningOutcome || null,
    createdAt: raw.createdAt || null,

  };

};

module.exports = { normalizeTrade };
