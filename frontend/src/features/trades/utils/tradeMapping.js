import { getRiskColor } from "./indicators.js";

/**
 * Maps trade history to the specific chart data points for visualization.
 * @param {Array} chartData Current chart data with (date, price, ema, rsi, etc)
 * @param {Array} trades Raw trade history from the API
 * @param {string} symbol Target symbol to filter
 * @returns {Array} Updated chartData with tradeBuy and tradeSell coordinates
 */
export const mapTradesToChartData = (chartData, trades, symbol) => {
  if (!chartData || chartData.length === 0) return [];
  if (!trades || trades.length === 0) return chartData;

  const symbolUpper = symbol.toUpperCase();
  
  // 1. Filter trades for the specific stock
  const relevantTrades = trades.filter((t) => t.symbol === symbolUpper);

  // 2. Map trades to chart points
  return chartData.map((d) => {
    // Find if any trades happened on this 'date' (YYYY-MM-DD)
    const dayTrades = relevantTrades.filter((t) => {
      const tradeDate = t.createdAt 
        ? new Date(t.createdAt).toISOString().split("T")[0]
        : null;
      return tradeDate === d.date;
    });

    if (dayTrades.length === 0) return { ...d, tradeBuy: null, tradeSell: null };

    // If multiple trades on same day, we'll take the most recent for simplicity or combine
    // For this implementation, we split them into Buy and Sell series for Recharts Scatter
    let buyPoint = null;
    let sellPoint = null;

    dayTrades.forEach(t => {
      const point = {
        price: t.price,
        type: t.type,
        riskScore: t.analysis?.riskScore,
        riskColor: getRiskColor(t.analysis?.riskScore)
      };

      if (t.type === "BUY") buyPoint = point;
      if (t.type === "SELL") sellPoint = point;
    });

    return {
      ...d,
      tradeBuy: buyPoint,
      tradeSell: sellPoint,
      buyPrice: buyPoint?.price || null,
      sellPrice: sellPoint?.price || null
    };
  });
};
