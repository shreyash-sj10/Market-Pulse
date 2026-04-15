export const QUERY_KEYS = {
  TRADES: ["trades"],
  PORTFOLIO: ["portfolio"],
  JOURNAL: ["journal"],
  PROFILE: ["profile"],
  MARKET: ["market"],
  TRACE: ["trace"],
};

export const queryKeys = {
  trades: () => QUERY_KEYS.TRADES,
  tradeHistory: (page = 1, limit = 10) => [...QUERY_KEYS.TRADES, "history", page, limit],
  preTrade: (symbol) => [...QUERY_KEYS.TRADES, "pre-trade", symbol ?? "unknown"],
  portfolioSummary: () => [...QUERY_KEYS.PORTFOLIO, "summary"],
  positions: () => [...QUERY_KEYS.PORTFOLIO, "positions"],
  journalSummary: () => [...QUERY_KEYS.JOURNAL, "summary"],
  profile: () => QUERY_KEYS.PROFILE,
  marketIndices: () => [...QUERY_KEYS.MARKET, "indices"],
  marketExplorer: () => [...QUERY_KEYS.MARKET, "explorer"],
  marketIntelligence: (scope) => [...QUERY_KEYS.MARKET, "intelligence", scope],
  marketHistory: (symbol, timeframe) => [...QUERY_KEYS.MARKET, "history", symbol ?? "unknown", timeframe ?? "1M"],
  traceList: () => [...QUERY_KEYS.TRACE, "list"],
  traceDetail: (traceId) => [...QUERY_KEYS.TRACE, "detail", traceId ?? "none"],
};
