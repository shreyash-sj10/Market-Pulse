const { SYSTEM_STATE } = require("../constants/systemState");

const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const isFiniteNumber = (value) => Number.isFinite(Number(value));

const derivePortfolioPositionsState = ({ holdingsCount = 0, positions = [] } = {}) => {
  if (!holdingsCount) return SYSTEM_STATE.EMPTY;

  if (!Array.isArray(positions) || positions.length === 0) {
    return SYSTEM_STATE.PARTIAL;
  }

  const hasFallback = positions.some((position) => position?.isFallback === true);
  if (hasFallback) {
    return SYSTEM_STATE.PARTIAL;
  }

  const hasValidCorePrice = positions.every((position) => isFiniteNumber(position?.currentPricePaise));
  if (!hasValidCorePrice) {
    return SYSTEM_STATE.PARTIAL;
  }

  const hasAnalytics = positions.every((position) =>
    isFiniteNumber(position?.investedValuePaise) &&
    isFiniteNumber(position?.currentValuePaise) &&
    isFiniteNumber(position?.unrealizedPnL) &&
    isFiniteNumber(position?.pnlPct)
  );

  return hasAnalytics ? SYSTEM_STATE.COMPLETE : SYSTEM_STATE.ACTIVE;
};

const derivePortfolioSummaryState = ({
  holdingsCount = 0,
  positions = [],
  summary = {},
} = {}) => {
  if (!holdingsCount) return SYSTEM_STATE.EMPTY;

  const positionsState = derivePortfolioPositionsState({ holdingsCount, positions });
  if (positionsState === SYSTEM_STATE.PARTIAL) return SYSTEM_STATE.PARTIAL;

  const hasSummaryAnalytics =
    isFiniteNumber(summary?.realizedPnL) &&
    isFiniteNumber(summary?.unrealizedPnL) &&
    isFiniteNumber(summary?.netEquity) &&
    isFiniteNumber(summary?.winRate) &&
    summary?.skillAudit &&
    summary?.behaviorInsights;

  if (!hasSummaryAnalytics) {
    return SYSTEM_STATE.ACTIVE;
  }

  return SYSTEM_STATE.COMPLETE;
};

const deriveIntelligenceState = ({ signals = [] } = {}) => {
  if (!Array.isArray(signals) || signals.length === 0) {
    return SYSTEM_STATE.EMPTY;
  }

  const usableSignals = signals.filter((signal) => signal && typeof signal === "object");
  if (usableSignals.length === 0) {
    return SYSTEM_STATE.PARTIAL;
  }

  const hasUnavailableSignals = usableSignals.some(
    (signal) => signal.status === "UNAVAILABLE" || hasText(signal.reason)
  );
  if (hasUnavailableSignals) {
    return SYSTEM_STATE.PARTIAL;
  }

  const hasCoreSignals = usableSignals.some(
    (signal) => hasText(signal.verdict) || hasText(signal.impact) || hasText(signal.event)
  );
  if (!hasCoreSignals) {
    return SYSTEM_STATE.PARTIAL;
  }

  const hasScoring = usableSignals.every((signal) => isFiniteNumber(signal.confidence));
  const hasExplanation = usableSignals.every(
    (signal) => hasText(signal.judgment) && hasText(signal.mechanism)
  );

  if (hasScoring && hasExplanation) {
    return SYSTEM_STATE.COMPLETE;
  }

  return SYSTEM_STATE.ACTIVE;
};

const deriveDecisionState = ({ hasRequiredInputs, isValidated } = {}) => {
  if (!hasRequiredInputs) {
    return SYSTEM_STATE.PARTIAL;
  }

  if (isValidated) {
    return SYSTEM_STATE.COMPLETE;
  }

  return SYSTEM_STATE.ACTIVE;
};

const isReflectionComplete = (reflection) =>
  reflection &&
  hasText(reflection.verdict) &&
  hasText(reflection.executionPattern) &&
  hasText(reflection.insight) &&
  hasText(reflection.improvement);

const deriveReflectionState = ({ closedTrades = [], reflections = [] } = {}) => {
  if (!Array.isArray(closedTrades) || closedTrades.length === 0) {
    return SYSTEM_STATE.EMPTY;
  }

  if (!Array.isArray(reflections) || reflections.length !== closedTrades.length) {
    return SYSTEM_STATE.PARTIAL;
  }

  return reflections.every(isReflectionComplete) ? SYSTEM_STATE.COMPLETE : SYSTEM_STATE.PARTIAL;
};

module.exports = {
  derivePortfolioPositionsState,
  derivePortfolioSummaryState,
  deriveIntelligenceState,
  deriveDecisionState,
  deriveReflectionState,
};
