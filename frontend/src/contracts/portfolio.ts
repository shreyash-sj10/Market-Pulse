export type PortfolioSummary = {
  totalValuePaise: number;
  totalPnlPct: number;
  balancePaise: number;
};

export type PortfolioPosition = {
  symbol: string | null;
  quantity: number;
  avgPricePaise: number;
  currentPricePaise: number;
  pnlPct: number;
};
