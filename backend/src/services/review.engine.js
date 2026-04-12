/**
 * INSTITUTIONAL REFLECTION ENGINE
 */

const analyzeReview = (trade, entryTrade = null) => {
  const mistakeTags = trade.analysis?.mistakeTags || [];
  const hasBadProcess = mistakeTags.length > 0;
  const isLoss = (trade.pnl || 0) <= 0;
  const intent = entryTrade?.parsedIntent?.strategy || 'GENERAL';

  // Plan vs Reality Audit
  let executionPattern = 'PLAN_ALIGNED';
  if (!isLoss && trade.pricePaise < (entryTrade?.targetPrice || 0) * 0.95) {
     executionPattern = 'EARLY_EXIT';
  } else if (!isLoss && trade.pricePaise >= (entryTrade?.targetPrice || 0)) {
     executionPattern = 'TARGET_HIT';
  } else if (isLoss && trade.pricePaise <= (entryTrade?.stopLoss || 0)) {
     executionPattern = 'STOPPED_OUT';
  } else if (isLoss && trade.pricePaise > (entryTrade?.stopLoss || 0)) {
     executionPattern = 'MANUAL_STOP_ADJUST';
  }

  let verdict, reflectionType, insight, improvement;
  
  if (!isLoss && !hasBadProcess) {
    verdict = 'DISCIPLINED PROFIT';
    reflectionType = 'SUCCESS_VALIDATION';
    insight = executionPattern === 'EARLY_EXIT' 
       ? `Profit realized, but you exited significantly before your target. Trust the ${intent} logic.`
       : `Execution fully aligned with ${intent} strategy. Target achieved with discipline.`;
    improvement = 'Review hold-discipline parameters.';
  } else if (!isLoss && hasBadProcess) {
    verdict = 'LUCKY PROFIT';
    reflectionType = 'HIDDEN_RISK_WARNING';
    insight = `Asset reached profit targets despite Process Violations. Luck is shielding you from critical flaws.`;
    improvement = 'Lock the terminal until process-reset is confirmed.';
  } else if (isLoss && !hasBadProcess) {
    verdict = 'DISCIPLINED LOSS';
    reflectionType = 'STATISTICAL_NORMALITY';
    insight = executionPattern === 'STOPPED_OUT'
       ? `Professional exit at Stop Loss. Capital preserved despite adverse volatility.`
       : `Manual exit before Stop Loss. Potentially saved alpha? Check if exit was logic-based.`;
    improvement = 'Continue protecting the downside.';
  } else if (isLoss && hasBadProcess) {
    verdict = 'POOR PROCESS';
    reflectionType = 'CRITICAL_FAILURE';
    insight = `Loss compounded by process failures and pattern: ${executionPattern}. Avoidable drawdown.`;
    improvement = 'Mental reset and risk-reduction required.';
  } else {
    verdict = 'NEUTRAL';
    reflectionType = 'GENERAL_INSIGHT';
    insight = 'Standard execution protocol observed.';
    improvement = 'Maintain routine discipline.';
  }

  return {
    verdict,
    executionPattern,
    strategyDescription: intent,
    reflection: {
      type: reflectionType,
      context: `Pattern: ${executionPattern} | Strategy: ${intent}`,
      insight,
      improvementSuggestion: improvement
    },
    isDisciplined: !hasBadProcess
  };
};

module.exports = { analyzeReview };
