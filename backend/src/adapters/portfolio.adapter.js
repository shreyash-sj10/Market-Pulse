const { calculatePct } = require("../utils/paise");

const adaptPortfolio = (portfolio) => {
  if (!portfolio) return null;

  const totalValuePaise = portfolio.netEquity || portfolio.totalValuePaise || 0;
  const balancePaise = portfolio.balance !== undefined ? portfolio.balance : (portfolio.balancePaise || 0);
  
  const investedPaise = portfolio.totalInvested || 0;
  let totalPnlPct = portfolio.totalPnlPct;

  if (totalPnlPct === undefined || totalPnlPct === null) {
      const unrealizedPaise = portfolio.unrealizedPnL || 0;
      const realizedPaise = portfolio.realizedPnL || 0;
      
      // PROTOCOL: Single Percentage Utility Enforcement
      totalPnlPct = calculatePct(unrealizedPaise + realizedPaise, investedPaise);
  }

  return {
    totalValuePaise,
    totalPnlPct,
    balancePaise,
    unrealizedPnLPaise: portfolio.unrealizedPnL || 0,
    realizedPnLPaise:   portfolio.realizedPnL   || 0,
    totalInvestedPaise: investedPaise,
    winRate:            portfolio.winRate        || 0,
  };
};

const adaptPositions = (positions) => {
  if (!Array.isArray(positions)) return [];
  return positions.map(p => ({
     symbol: p.symbol || p.fullSymbol || null,
     quantity: p.quantity || 0,
     avgPricePaise: p.avgPricePaise || 0,
     currentPricePaise: p.currentPricePaise || 0,
     pnlPct: p.pnlPct || 0
  }));
};

module.exports = { adaptPortfolio, adaptPositions };
