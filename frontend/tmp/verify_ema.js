const calculateEMA = (data, window = 9) => {
  if (!data || data.length === 0) return [];
  const k = 2 / (window + 1);
  let ema = data[0].price;
  
  return data.map((d, index) => {
    if (index === 0) {
      return { ...d, ema };
    }
    ema = d.price * k + ema * (1 - k);
    return { ...d, ema: Number(ema.toFixed(2)) };
  });
};

const mockPrices = [
  { price: 100 },
  { price: 105 },
  { price: 110 },
  { price: 108 },
  { price: 112 },
];

const results = calculateEMA(mockPrices, 3);
console.log(JSON.stringify(results, null, 2));
