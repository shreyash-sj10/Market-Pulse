const calculateMistakeAnalysis = require("../mistakeAnalysis.service");

describe("calculateMistakeAnalysis - canonical paise contract", () => {
  const base = (overrides = {}) => ({
    tradeValue: 500,
    balanceBeforeTrade: 10000,
    stopLossPaise: 145,
    targetPricePaise: 160,
    entryPricePaise: 150,
    tradesLast24h: 2,
    ...overrides,
  });

  it("flags OVER_RISK across configured thresholds", () => {
    expect(calculateMistakeAnalysis(base({ tradeValue: 600 })).mistakeTags).toContain("OVER_RISK");
    expect(calculateMistakeAnalysis(base({ tradeValue: 1100 })).mistakeTags).toContain("OVER_RISK");
    expect(calculateMistakeAnalysis(base({ tradeValue: 2100 })).mistakeTags).toContain("OVER_RISK");
  });

  it("flags NO_STOP_LOSS when stopLossPaise missing", () => {
    const result = calculateMistakeAnalysis(base({ stopLossPaise: null }));
    expect(result.mistakeTags).toContain("NO_STOP_LOSS");
  });

  it("flags POOR_RR for weak RR geometry", () => {
    const result = calculateMistakeAnalysis(
      base({ entryPricePaise: 150, stopLossPaise: 145, targetPricePaise: 153 })
    );
    expect(result.mistakeTags).toContain("POOR_RR");
  });

  it("flags OVERTRADING above configured frequency", () => {
    const result = calculateMistakeAnalysis(base({ tradesLast24h: 11 }));
    expect(result.mistakeTags).toContain("OVERTRADING");
  });

  it("clamps risk score to 100", () => {
    const result = calculateMistakeAnalysis({
      tradeValue: 9500,
      balanceBeforeTrade: 10000,
      stopLossPaise: null,
      targetPricePaise: 151,
      entryPricePaise: 150,
      tradesLast24h: 15,
      lastTradePnL: -1,
      lastTradeTime: new Date(),
    });
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });
});
