export const calculateEMA = (data, window = 9) => {
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

export const mergeTradesIntoPriceData = (priceData, trades, symbol) => {
  if (!priceData || priceData.length === 0) return [];
  
  // Filter trades for the specific stock requested
  const relevantTrades = trades.filter((t) => t.symbol === symbol.toUpperCase());
  
  return priceData.map((d) => {
    // Exact mapping of historical daily trade executions to the D-resolution candle date
    const dayTrades = relevantTrades.filter((t) => {
      // In JS, depending on the format, we split the ISO string
      const tradeDate = t.executedAt 
        ? new Date(t.executedAt).toISOString().split("T")[0]
        : (t.createdAt ? new Date(t.createdAt).toISOString().split("T")[0] : null);
      return tradeDate === d.date;
    });
    
    let buyTradePrice = null;
    let sellTradePrice = null;
    let maxRisk = null;
    const mistakeTags = [];
    
    dayTrades.forEach(t => {
      if (t.type === "BUY") buyTradePrice = t.price;
      if (t.type === "SELL") sellTradePrice = t.price;
      if (t.analysis?.riskScore > (maxRisk || 0)) maxRisk = t.analysis.riskScore;
      if (t.analysis?.mistakeTags) mistakeTags.push(...t.analysis.mistakeTags);
    });

    return {
      ...d,
      buyTrade: buyTradePrice,
      sellTrade: sellTradePrice,
      riskScore: maxRisk,
      mistakeTags: [...new Set(mistakeTags)],
      hasTrade: dayTrades.length > 0
    };
  });
};
