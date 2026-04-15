const toHoldingsObject = (holdings) => {
  if (!holdings) return {};
  if (holdings instanceof Map) return Object.fromEntries(holdings);
  if (Array.isArray(holdings)) {
    return holdings.reduce((acc, item) => {
      if (!item?.symbol) return acc;
      const key = String(item.symbol).toUpperCase().trim();
      acc[key] = {
        quantity: Number(item.quantity) || 0,
        avgCostPaise: Number(item.avgCost ?? item.avgCostPaise ?? item.avgPricePaise) || 0,
        stopLossPaise: Number(item.stopLossPaise) || null,
        targetPricePaise: Number(item.targetPricePaise) || null,
      };
      return acc;
    }, {});
  }
  return { ...holdings };
};

const toHoldingsArray = (holdings) => {
  const holdingsObject = toHoldingsObject(holdings);
  return Object.entries(holdingsObject).map(([safeSymbol, data]) => ({
    symbol: safeSymbol.includes("_") ? safeSymbol.replace(/_/g, ".") : safeSymbol,
    quantity: Number(data?.quantity) || 0,
    avgPricePaise: Math.round(Number(data?.avgCostPaise) || 0),
    stopLossPaise: Number(data?.stopLossPaise) || null,
    targetPricePaise: Number(data?.targetPricePaise) || null,
  }));
};

const toHoldingsLookup = (holdings) => {
  const arr = toHoldingsArray(holdings);
  return arr.reduce((acc, item) => {
    const full = (item.symbol || "").toUpperCase();
    const base = full.split(".")[0];
    if (full) acc[full] = item;
    if (base) acc[base] = item;
    return acc;
  }, {});
};

module.exports = { toHoldingsObject, toHoldingsArray, toHoldingsLookup };
