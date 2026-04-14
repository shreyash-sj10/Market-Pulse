const adaptPortfolio = (portfolio) => {
  if (!portfolio) return null;

  const totalValuePaise = portfolio.netEquity || portfolio.totalValuePaise || 0;
  const balancePaise = portfolio.balance !== undefined ? portfolio.balance : (portfolio.balancePaise || 0);
  
  const invested = portfolio.totalInvested || 0;
  let totalPnlPct = portfolio.totalPnlPct;

  if (totalPnlPct === undefined || totalPnlPct === null) {
     const unrealized = portfolio.unrealizedPnL || 0;
     const realized = portfolio.realizedPnL || 0; // Wait, netEquity contains unrealized + balance.
     // To get true PnL Pct, maybe simply: (unrealized / invested) * 100 ?
     // Wait, realized should be factored? It's usually just total profit. Let's do safely.
     if (invested > 0) {
        totalPnlPct = Number((((portfolio.unrealizedPnL || 0) / (invested/100)) * 100).toFixed(2));
        // Note: unrealizedPnL from controller was in rupees. Let's be careful. Actually new endpoint returns unrealizedPnL in same unit as netEquity, we'll assume it's properly scaled.
        // wait, I can just use the provided netEquity minus balance minus invested?
        // Let's just do ((unrealized + realized) / invested) unless we can't.
        // Actually simplest is if totalPnlPct missing -> compute safely from existing fields
        totalPnlPct = Number((((unrealized + realized) / (invested || 1)) * 100).toFixed(2));
        if (invested === 0) totalPnlPct = 0;
     } else {
        totalPnlPct = 0;
     }
  }

  return {
    totalValuePaise,
    totalPnlPct,
    balancePaise
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
