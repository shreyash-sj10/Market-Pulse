const { SYSTEM_CONFIG } = require("../config/system.config");
const { calculateRR } = require("./risk.engine");

const calculateMistakeAnalysis = ({
  tradeValue,
  balanceBeforeTrade,
  stopLossPaise,
  targetPricePaise,
  entryPricePaise,
  tradesLast24h,
  lastTradePnL,
  lastTradeTime,
}) => {
  const cfg = SYSTEM_CONFIG.mistakeAnalysis;
  let riskScore = 0;
  const mistakeTags = new Set();

  const riskPercent = (tradeValue / balanceBeforeTrade) * 100;
  if (riskPercent > cfg.riskPercent.high) {
    riskScore += cfg.riskPenalty.high;
    mistakeTags.add("OVER_RISK");
  } else if (riskPercent > cfg.riskPercent.medium) {
    riskScore += cfg.riskPenalty.medium;
    mistakeTags.add("OVER_RISK");
  } else if (riskPercent > cfg.riskPercent.low) {
    riskScore += cfg.riskPenalty.low;
    mistakeTags.add("OVER_RISK");
  }

  if (!stopLossPaise) {
    riskScore += cfg.noStopLossPenalty;
    mistakeTags.add("NO_STOP_LOSS");
  }

  if (stopLossPaise && targetPricePaise && entryPricePaise) {
    const rr = calculateRR(entryPricePaise, stopLossPaise, targetPricePaise);
    if (rr !== null) {
      if (rr < cfg.poorRr.criticalThreshold) {
        riskScore += cfg.poorRr.criticalPenalty;
        mistakeTags.add("POOR_RR");
      } else if (rr < cfg.poorRr.warningThreshold) {
        riskScore += cfg.poorRr.warningPenalty;
        mistakeTags.add("POOR_RR");
      }
    }
  }

  if (tradesLast24h > cfg.overtrading.highThreshold) {
    riskScore += cfg.overtrading.highPenalty;
    mistakeTags.add("OVERTRADING");
  } else if (tradesLast24h > cfg.overtrading.mediumThreshold) {
    riskScore += cfg.overtrading.mediumPenalty;
    mistakeTags.add("OVERTRADING");
  }

  if (lastTradePnL < 0 && lastTradeTime) {
    const timeSinceLoss = (Date.now() - new Date(lastTradeTime).getTime()) / (1000 * 60 * 60);
    if (timeSinceLoss < cfg.revengeTrading.lookbackHours) {
      riskScore += cfg.revengeTrading.penalty;
      mistakeTags.add("REVENGE_TRADING");
    }
  }

  if (riskScore > cfg.maxRiskScore) riskScore = cfg.maxRiskScore;

  return {
    riskScore,
    mistakeTags: Array.from(mistakeTags),
  };
};

module.exports = calculateMistakeAnalysis;
