const marketDataService = require('./marketData.service');

/**
 * MISSED OPPORTUNITY ENGINE
 * Analyzes market data following a trade's exit point.
 */

const calculateMissedOpportunity = async (trade) => {
  if (trade.type !== 'SELL' || !trade.createdAt) return null;

  try {
    // 1. Fetch historical data starting from trade execution time
    const result = await marketDataService.getHistorical(trade.symbol, '1d');
    const prices = result.data?.prices || [];
    
    // 2. Filter for points AFTER the trade
    const tradeTime = new Date(trade.createdAt);
    const postTradePrices = prices.filter(p => new Date(p.date) > tradeTime).slice(0, 20);

    if (postTradePrices.length === 0) return null;

    // 3. Find Max High
    const peakPoint = postTradePrices.reduce((prev, curr) => (curr.high > prev.high) ? curr : prev);
    const peakPricePaise = Math.round(peakPoint.high);

    // 4. Calculate Opportunity Cost
    if (peakPricePaise > trade.price) {
      const opportunityPaise = (peakPricePaise - trade.price) * trade.quantity;
      const opportunityPct = ((peakPricePaise - trade.price) / trade.price) * 100;

      return {
        maxPotentialProfit: opportunityPaise,
        maxProfitPct: Number(opportunityPct.toFixed(2)),
        peakPrice: peakPricePaise,
        peakDate: peakPoint.date
      };
    }

    return { maxPotentialProfit: 0, maxProfitPct: 0, peakPrice: trade.price };
  } catch (error) {
    console.error("[Opportunity Engine Error]", error);
    return null;
  }
};

module.exports = { calculateMissedOpportunity };
