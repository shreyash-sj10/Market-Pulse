/**
 * DETERMINISTIC STRATEGY VALIDATOR
 * Compares parsed intent with hard technical context.
 */

const validateStrategy = (parsedIntent, context) => {
  const { strategy } = parsedIntent;
  const { rsi, trend, volatility } = context;

  const evaluation = {
    isValid: true,
    mismatchReason: null,
    score: 100
  };

  switch (strategy) {
    case 'BREAKOUT':
      // Breakouts usually require high RSI (momentum) or explosive volume
      if (rsi < 55) {
        evaluation.isValid = false;
        evaluation.mismatchReason = "Momentum (RSI) too low for a sustained breakout play.";
        evaluation.score = 40;
      }
      break;

    case 'MEAN_REVERSION':
      // Mean reversion usually happens at extremes
      if (rsi > 40 && rsi < 60) {
        evaluation.isValid = false;
        evaluation.mismatchReason = "Asset is in the 'Neutral Zone'; mean reversion probability is low.";
        evaluation.score = 30;
      }
      break;

    case 'TREND_FOLLOWING':
      // Must match the primary trend
      if (trend === 'BEARISH') {
        evaluation.isValid = false;
        evaluation.mismatchReason = "Primary trend is Bearish; Trend Following Buy is high-risk.";
        evaluation.score = 20;
      }
      break;

    default:
      evaluation.isValid = true;
      evaluation.score = 80;
  }

  return evaluation;
};

module.exports = { validateStrategy };
