const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const SYSTEM_CONFIG = {
  risk: {
    minRr: toNumber(process.env.MIN_RR, 1.2),
  },
  mistakeAnalysis: {
    riskPercent: {
      high: toNumber(process.env.MISTAKE_RISK_PCT_HIGH, 20),
      medium: toNumber(process.env.MISTAKE_RISK_PCT_MEDIUM, 10),
      low: toNumber(process.env.MISTAKE_RISK_PCT_LOW, 5),
    },
    riskPenalty: {
      high: toNumber(process.env.MISTAKE_RISK_PENALTY_HIGH, 40),
      medium: toNumber(process.env.MISTAKE_RISK_PENALTY_MEDIUM, 25),
      low: toNumber(process.env.MISTAKE_RISK_PENALTY_LOW, 10),
    },
    noStopLossPenalty: toNumber(process.env.MISTAKE_NO_SL_PENALTY, 20),
    poorRr: {
      criticalThreshold: toNumber(process.env.MISTAKE_POOR_RR_CRITICAL, 1),
      warningThreshold: toNumber(process.env.MISTAKE_POOR_RR_WARNING, 2),
      criticalPenalty: toNumber(process.env.MISTAKE_POOR_RR_CRITICAL_PENALTY, 25),
      warningPenalty: toNumber(process.env.MISTAKE_POOR_RR_WARNING_PENALTY, 10),
    },
    overtrading: {
      highThreshold: toNumber(process.env.MISTAKE_OVERTRADING_HIGH, 10),
      mediumThreshold: toNumber(process.env.MISTAKE_OVERTRADING_MEDIUM, 5),
      highPenalty: toNumber(process.env.MISTAKE_OVERTRADING_HIGH_PENALTY, 20),
      mediumPenalty: toNumber(process.env.MISTAKE_OVERTRADING_MEDIUM_PENALTY, 10),
    },
    revengeTrading: {
      lookbackHours: toNumber(process.env.MISTAKE_REVENGE_LOOKBACK_HOURS, 2),
      penalty: toNumber(process.env.MISTAKE_REVENGE_PENALTY, 30),
    },
    maxRiskScore: toNumber(process.env.MISTAKE_MAX_RISK_SCORE, 100),
  },
  behavior: {
    revengeWindowMinutes: toNumber(process.env.BEHAVIOR_REVENGE_WINDOW_MIN, 60),
    overtradingPerDayLimit: toNumber(process.env.BEHAVIOR_OVERTRADING_PER_DAY, 5),
    holdingLosersMultiplier: toNumber(process.env.BEHAVIOR_HOLDING_LOSERS_MULTIPLIER, 1.5),
    averagingDownWindowHours: toNumber(process.env.BEHAVIOR_AVERAGING_DOWN_WINDOW_HOURS, 4),
    revengeConfidenceScale: toNumber(process.env.BEHAVIOR_REVENGE_CONF_SCALE, 200),
    overtradingConfidenceScale: toNumber(process.env.BEHAVIOR_OVERTRADING_CONF_SCALE, 50),
    earlyExitConfidenceScale: toNumber(process.env.BEHAVIOR_EARLY_EXIT_CONF_SCALE, 150),
    holdingLosersConfidence: toNumber(process.env.BEHAVIOR_HOLDING_LOSERS_CONFIDENCE, 85),
    averagingDownConfidence: toNumber(process.env.BEHAVIOR_AVERAGING_DOWN_CONFIDENCE, 70),
  },
  intelligence: {
    preTrade: {
      revengeWindowMs: toNumber(process.env.INTEL_REVENGE_WINDOW_MS, 30 * 60 * 1000),
      avoidConsensusPenalty: toNumber(process.env.INTEL_AVOID_CONSENSUS_PENALTY, 40),
      strategyInvalidPenalty: toNumber(process.env.INTEL_STRATEGY_INVALID_PENALTY, 20),
      revengeFlagPenalty: toNumber(process.env.INTEL_REVENGE_FLAG_PENALTY, 30),
      lowRrPenalty: toNumber(process.env.INTEL_LOW_RR_PENALTY, 15),
      lowRrThreshold: toNumber(process.env.INTEL_LOW_RR_THRESHOLD, 1.5),
      highRiskBoundary: toNumber(process.env.INTEL_HIGH_RISK_BOUNDARY, 50),
      adaptiveHighPenalty: toNumber(process.env.INTEL_ADAPTIVE_HIGH_PENALTY, 10),
      avoidBoundary: toNumber(process.env.INTEL_AVOID_BOUNDARY, 50),
      waitBoundary: toNumber(process.env.INTEL_WAIT_BOUNDARY, 70),
      behavioralScorePenaltyPerFlag: toNumber(process.env.INTEL_BEHAVIOR_SCORE_PER_FLAG, 20),
      behavioralDisciplinePenaltyPerFlag: toNumber(process.env.INTEL_BEHAVIOR_DISCIPLINE_PER_FLAG, 30),
      optimalRrThreshold: toNumber(process.env.INTEL_OPTIMAL_RR_THRESHOLD, 2),
      setupValidScore: toNumber(process.env.INTEL_SETUP_VALID_SCORE, 90),
      setupInvalidScore: toNumber(process.env.INTEL_SETUP_INVALID_SCORE, 40),
      alignedScore: toNumber(process.env.INTEL_MARKET_ALIGNED_SCORE, 95),
      conflictedScore: toNumber(process.env.INTEL_MARKET_CONFLICTED_SCORE, 30),
      sectorStrongConfidence: toNumber(process.env.INTEL_SECTOR_STRONG_CONFIDENCE, 70),
      sectorStrongScore: toNumber(process.env.INTEL_SECTOR_STRONG_SCORE, 90),
      sectorNeutralScore: toNumber(process.env.INTEL_SECTOR_NEUTRAL_SCORE, 60),
      rrOptimalScore: toNumber(process.env.INTEL_RR_OPTIMAL_SCORE, 95),
      rrAcceptableScore: toNumber(process.env.INTEL_RR_ACCEPTABLE_SCORE, 75),
      rrPoorScore: toNumber(process.env.INTEL_RR_POOR_SCORE, 40),
    },
  },
  trade: {
    executionAvoidRiskScore: toNumber(process.env.TRADE_AVOID_RISK_SCORE, 70),
  },
  marketData: {
    quoteCacheTtlMs: toNumber(process.env.MARKET_CACHE_TTL_MS, 30000),
    batchChunkSize: toNumber(process.env.MARKET_BATCH_CHUNK_SIZE, 25),
  },
};

module.exports = { SYSTEM_CONFIG };
