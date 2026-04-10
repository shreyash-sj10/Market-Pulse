/**
 * DETERMINISTIC TRADE REVIEW ENGINE
 * Classifies trade quality based on Strategy Discipline vs. Pnl Outcome.
 */

const getTradeVerdict = (trade) => {
  const isProfitable = (trade.pnl || 0) > 0;
  const strategyMatch = trade.analysis?.strategyMatch;
  const isStrategyValid = strategyMatch ? strategyMatch.isValid : true;

  if (isStrategyValid && isProfitable) return "GOOD";
  if (isStrategyValid && !isProfitable) return "GOOD"; // Discipline in a losing trade is still "Good"
  if (!isStrategyValid && isProfitable) return "LUCK";
  if (!isStrategyValid && !isProfitable) return "POOR";

  return "NEUTRAL";
};

const getImprovementRule = (mistakeTags = []) => {
  const ruleMap = {
    'REVENGE_TRADING': "Wait at least 2 hours after a realized loss before opening a new position.",
    'OVERTRADING': "Limit your daily executions to 5 high-confidence setups.",
    'EARLY_EXIT': "Trust your stop-loss and target prices; avoid manual liquidation within 1% of target.",
    'HOLDING_LOSERS': "Liquidate any position that breaches its initial stop-loss level immediately.",
    'AVERAGING_DOWN': "Never add capital to a losing position to lower your average cost.",
    'POOR_RR': "Focus on setups with at least a 1:2 risk-to-reward ratio to ensure long-term profitability."
  };

  const primaryMistake = mistakeTags[0];
  return ruleMap[primaryMistake] || "Focus on maintaining your pre-defined risk-to-reward ratio.";
};

const analyzeReview = (trade) => {
  const verdict = getTradeVerdict(trade);
  const rule = getImprovementRule(trade.analysis?.mistakeTags);
  
  return {
    verdict,
    improvementRule: rule,
    strategyDescription: trade.parsedIntent?.strategy || "General Execution",
    isDisciplined: trade.analysis?.strategyMatch?.isValid ?? true
  };
};

module.exports = { analyzeReview };
