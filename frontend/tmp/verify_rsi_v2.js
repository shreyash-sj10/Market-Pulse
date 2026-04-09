
const calculateRSI = (data, period = 14) => {
  if (!data || data.length < period) return data.map(d => ({ ...d, rsi: null }));

  let gains = [];
  let losses = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i].price - data[i - 1].price;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  const results = [...data];
  results[0].rsi = null; 

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  results[period].rsi = 100 - 100 / (1 + firstRS);

  for (let i = period + 1; i < data.length; i++) {
    const currentGain = gains[i - 1];
    const currentLoss = losses[i - 1];

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    results[i].rsi = Number((100 - 100 / (1 + rs)).toFixed(2));
  }

  return results;
};

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
