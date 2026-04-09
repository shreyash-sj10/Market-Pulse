const formatTrade = (trade) => ({
  id: trade._id,
  symbol: trade.symbol,
  type: trade.type,
  quantity: trade.quantity,
  price: trade.price,
  totalValue: trade.totalValue,
  executedAt: trade.createdAt,
  analysis: trade.analysis
    ? {
        riskScore: trade.analysis.riskScore,
        mistakeTags: trade.analysis.mistakeTags,
        explanation: trade.analysis.explanation,
        humanBehavior: trade.analysis.humanBehavior,
      }
    : null,
});

const formatTradeList = (trades) => trades.map((trade) => formatTrade(trade));

const formatPortfolioSummary = (summary) => ({
  tradeCount: summary.tradeCount,
  totalInvested: summary.totalInvested,
  realizedPL: summary.realizedPL,
  winRate: summary.winRate,
  holdings: summary.holdings,
  holdingsBasis: summary.holdingsBasis,
  behaviorInsights: summary.behaviorInsights,
  chartData: summary.chartData,
});

module.exports = {
  formatTrade,
  formatTradeList,
  formatPortfolioSummary,
};
