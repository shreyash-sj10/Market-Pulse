
const getRiskColor = (score) => {
  if (typeof score !== 'number') return "#94a3b8"; 
  if (score > 70) return "#f43f5e"; 
  if (score < 40) return "#10b981"; 
  return "#f59e0b"; 
};

const mapTradesToChartData = (chartData, trades, symbol) => {
  if (!chartData || chartData.length === 0) return [];
  if (!trades || trades.length === 0) return chartData;

  const symbolUpper = symbol.toUpperCase();
  const relevantTrades = trades.filter((t) => t.symbol === symbolUpper);

  return chartData.map((d) => {
    const dayTrades = relevantTrades.filter((t) => {
      const tradeDate = t.createdAt 
        ? new Date(t.createdAt).toISOString().split("T")[0]
        : null;
      return tradeDate === d.date;
    });

    if (dayTrades.length === 0) return { ...d, tradeBuy: null, tradeSell: null };

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
      tradeSell: sellPoint
    };
  });
};

const mockChartData = [
  { date: '2026-04-01', price: 100 },
  { date: '2026-04-02', price: 102 },
  { date: '2026-04-03', price: 105 },
];

const mockTrades = [
  {
    symbol: 'TSLA',
    price: 101.5,
    type: 'BUY',
    createdAt: '2026-04-01T14:30:00Z',
    analysis: { riskScore: 25 }
  },
  {
    symbol: 'TSLA',
    price: 106,
    type: 'SELL',
    createdAt: '2026-04-03T09:15:00Z',
    analysis: { riskScore: 85 }
  }
];

const results = mapTradesToChartData(mockChartData, mockTrades, 'TSLA');

console.log("Mapping Results:");
results.forEach(d => {
  console.log(`Date: ${d.date}`);
  if (d.tradeBuy) console.log(`  BUY: $${d.tradeBuy.price} (Risk: ${d.tradeBuy.riskScore}, Color: ${d.tradeBuy.riskColor})`);
  if (d.tradeSell) console.log(`  SELL: $${d.tradeSell.price} (Risk: ${d.tradeSell.riskScore}, Color: ${d.tradeSell.riskColor})`);
});
