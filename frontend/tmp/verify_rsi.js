import { calculateRSI } from './src/features/trades/utils/indicators.js';

const mockData = [
  { price: 44.34 }, { price: 44.09 }, { price: 44.15 }, { price: 43.61 },
  { price: 44.33 }, { price: 44.83 }, { price: 45.10 }, { price: 45.42 },
  { price: 45.84 }, { price: 46.08 }, { price: 45.89 }, { price: 46.03 },
  { price: 45.61 }, { price: 46.28 }, { price: 46.28 }, { price: 46.00 },
  { price: 46.03 }, { price: 46.41 }, { price: 46.22 }, { price: 46.66 },
];

const results = calculateRSI(mockData, 14);

console.log("RSI Results:");
results.forEach((d, i) => {
  console.log(`Day ${i+1}: Price ${d.price.toFixed(2)} -> RSI: ${d.rsi}`);
});
