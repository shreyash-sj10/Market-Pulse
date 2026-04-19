const adaptTrade = (trade) => {
  if (!trade) return null;
  const pricePaise = trade.pricePaise || 0;
  const totalValuePaise =
    trade.totalValuePaise != null
      ? trade.totalValuePaise
      : Math.round((trade.quantity || 0) * pricePaise);
  return {
    tradeId: trade.tradeId || trade.id || trade._id || null,
    symbol: trade.symbol || null,
    side: trade.type || null,
    productType: trade.productType || "DELIVERY",
    pricePaise,
    /** Authoritative execution price (paise); same as pricePaise for executed rows. */
    executionPricePaise: pricePaise,
    totalValuePaise,
    stopLossPaise: trade.stopLossPaise || null,
    targetPricePaise: trade.targetPricePaise || null,
    quantity: trade.quantity || 0,
    preTradeEmotion: trade.preTradeEmotion || null,
    /** Realized PnL (paise) is only meaningful for SELL legs; omit when absent. */
    ...(typeof trade.pnlPaise === "number" ? { pnlPaise: trade.pnlPaise } : {}),
    pnlPct: trade.pnlPct || 0,
    status: trade.status || "UNKNOWN",
    reflectionStatus: trade.reflectionStatus ?? null,
    decisionSnapshot: trade.decisionSnapshot || trade.preTradeSnapshot || null,
    learningSurface: trade.learningOutcome || trade.reflection || null,
    trace: trade.trace || null,
    ai: trade.ai || null,
  };
};

module.exports = { adaptTrade };
