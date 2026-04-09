import { mapTradesToChartData } from './src/features/trades/utils/tradeMapping.js';

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
  if (d.tradeBuy) console.log(`  BUY: $${d.tradeBuy.price} (Risk: ${d.tradeBuy.riskScore})`);
  if (d.tradeSell) console.log(`  SELL: $${d.tradeSell.price} (Risk: ${d.tradeSell.riskScore})`);
});
