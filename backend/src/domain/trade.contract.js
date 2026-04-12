const VALID_SIDES = new Set(["BUY", "SELL"]);

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
};

const computeRr = (side, pricePaise, stopLoss, targetPrice) => {
  if (!VALID_SIDES.has(side)) {
    throw new Error(`INVALID_TRADE_SIDE: ${side}`);
  }

  const entry = toNullableNumber(pricePaise);
  const sl = toNullableNumber(stopLoss);
  const target = toNullableNumber(targetPrice);

  if (entry === null || sl === null || target === null) return null;

  const risk = side === "BUY" ? entry - sl : sl - entry;
  const reward = side === "BUY" ? target - entry : entry - target;

  if (risk <= 0 || reward <= 0) return null;
  return Number((reward / risk).toFixed(2));
};

const normalizeTrade = (rawTrade) => {
  if (!rawTrade) return null;

  const raw = typeof rawTrade.toObject === "function" ? rawTrade.toObject() : rawTrade;
  const side = raw.side || raw.type;

  if (!VALID_SIDES.has(side)) {
    throw new Error(`INVALID_TRADE_SIDE: ${side}`);
  }

  const pricePaise = Math.round(toNullableNumber(raw.pricePaise ?? raw.price) || 0);
  const stopLossPaise = toNullableNumber(raw.stopLossPaise ?? raw.stopLoss);
  const targetPricePaise = toNullableNumber(raw.targetPricePaise ?? raw.targetPrice);
  const rr = toNullableNumber(raw.rr) ?? toNullableNumber(raw.rrRatio) ?? computeRr(side, pricePaise, stopLossPaise, targetPricePaise);

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
    side,
    quantity: toNullableNumber(raw.quantity) ?? 0,
    pricePaise,
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
    openedAt: raw.openedAt || raw.entryTrade?.createdAt || (side === "BUY" ? raw.createdAt : null) || null,
    closedAt: raw.closedAt || (side === "SELL" ? raw.createdAt : null) || null,
    pnlPaise: toNullableNumber(raw.pnlPaise ?? raw.pnl),
    pnlPct: toNullableNumber(raw.pnlPct ?? raw.pnlPercentage),
    entryTradeId: toId(raw.entryTradeId || raw.entryTrade),
    entryPlan: raw.entryPlan || null,
    decisionSnapshot: raw.decisionSnapshot || null,
    learningOutcome: raw.learningOutcome || null,
    createdAt: raw.createdAt || null,

  };

};

module.exports = { normalizeTrade };
