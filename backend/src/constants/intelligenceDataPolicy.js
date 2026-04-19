/**
 * Global insufficient-data contract: weak inputs must not yield strong directional verdicts.
 */

const INSUFFICIENT_DATA = "INSUFFICIENT_DATA";

/**
 * When true, callers must not emit BUY / AVOID as a "strong" rule verdict (use WAIT / soften).
 */
const shouldSoftenStrongVerdict = ({ signalCount = 0, avgConfidence = 0, minSignals = 2, minAvgConfidence = 52 } = {}) => {
  if (!Number.isFinite(signalCount) || signalCount < minSignals) return true;
  if (!Number.isFinite(avgConfidence) || avgConfidence < minAvgConfidence) return true;
  return false;
};

module.exports = {
  INSUFFICIENT_DATA,
  shouldSoftenStrongVerdict,
};
