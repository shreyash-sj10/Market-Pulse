const adaptTrade = (trade) => {
  if (!trade) return null;
  return {
    tradeId: trade.id || trade._id || null,
    symbol: trade.symbol || null,
    side: trade.type || null,
    pricePaise: trade.pricePaise || 0,
    stopLossPaise: trade.stopLossPaise || null,
    targetPricePaise: trade.targetPricePaise || null,
    quantity: trade.quantity || 0,
    pnlPct: trade.pnlPct || 0,
    status: trade.status || "UNKNOWN",
    decisionSnapshot: trade.decisionSnapshot || null,
    trace: trade.trace || null,
    ai: trade.ai || null,
  };
};

module.exports = { adaptTrade };
