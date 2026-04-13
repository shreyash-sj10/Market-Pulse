export const calculateEMA = (data, window = 9) => {
  if (!data || data.length === 0) return [];
  const k = 2 / (window + 1);
  let ema = data[0].close;
  
  return data.map((d, index) => {
    if (index === 0) {
      return { ...d, ema };
    }
    ema = d.close * k + ema * (1 - k);
    return { ...d, ema: Number(ema.toFixed(2)) };
  });
};
