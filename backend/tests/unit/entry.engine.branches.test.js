jest.mock("../../src/services/marketHours.service", () => ({
  getSquareoffMinutesIst: jest.fn(() => 15 * 60 + 30),
}));

const {
  evaluateEntryDecision,
  mapDecisionVerdictToAuthorityVerdict,
} = require("../../src/engines/entry.engine");
const { getSquareoffMinutesIst } = require("../../src/services/marketHours.service");

const threeClosedTrades = () => {
  const t0 = Date.now();
  return [
    { symbol: "A", entryTime: t0 - 300_000, exitTime: t0 - 290_000, pnlPaise: 100 },
    { symbol: "B", entryTime: t0 - 280_000, exitTime: t0 - 270_000, pnlPaise: -50 },
    { symbol: "C", entryTime: t0 - 260_000, exitTime: t0 - 250_000, pnlPaise: 80 },
  ];
};

describe("entry.engine branch coverage", () => {
  it("throws on invalid input", () => {
    expect(() => evaluateEntryDecision(null)).toThrow("ENTRY_ENGINE_INVALID_INPUT");
  });

  it("returns BLOCK when behavior data is unavailable", () => {
    const result = evaluateEntryDecision({
      plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      marketContext: { status: "VALID", consensusVerdict: "BUY", strategyValid: true },
      behaviorContext: { status: "UNAVAILABLE", flags: [] },
    });

    expect(result.verdict).toBe("BLOCK");
    expect(result.reason).toBe("INSUFFICIENT_BEHAVIOR_DATA");
  });

  it("returns BLOCK for invalid plan", () => {
    const result = evaluateEntryDecision({
      plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9990, targetPricePaise: 10010 },
      marketContext: { status: "VALID", consensusVerdict: "BUY", strategyValid: true },
      behaviorContext: { status: "VALID", flags: [] },
    });

    expect(result.verdict).toBe("BLOCK");
    expect(result.reason).toBe("INVALID_PLAN");
  });

  it("includes risk flags when revenge and overtrading are present", () => {
    const result = evaluateEntryDecision({
      plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      marketContext: { status: "VALID", consensusVerdict: "AVOID", strategyValid: false, adaptedRiskLevel: "HIGH" },
      behaviorContext: { status: "VALID", flags: ["REVENGE_TRADING_RISK", "OVERTRADING_RISK"] },
    });

    expect(result.reasons).toContain("REVENGE_TRADING_RISK");
    expect(result.reasons).toContain("OVERTRADING_RISK");
    expect(result.reasons).toContain("ADAPTIVE_HIGH_RISK");
  });

  it("throws dependency confusion when forceBlock conflicts with ALLOW", () => {
    expect(() =>
      evaluateEntryDecision({
        plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 13000 },
        marketContext: { status: "VALID", consensusVerdict: "BUY", strategyValid: true, forceBlock: true },
        behaviorContext: { status: "VALID", flags: [] },
      })
    ).toThrow("ENTRY_ENGINE_DEPENDENCY_CONFUSION");
  });

  it("throws on unsupported decision verdict mapping", () => {
    expect(() => mapDecisionVerdictToAuthorityVerdict("UNKNOWN")).toThrow("ENTRY_ENGINE_DEPENDENCY_CONFUSION");
  });

  it("uses setup score 70 for non-BUY side when scores are implicit", () => {
    const result = evaluateEntryDecision({
      plan: { side: "SELL", pricePaise: 10000 },
      marketContext: { status: "VALID", consensusVerdict: "BUY" },
      behaviorContext: { status: "VALID", flags: [], closedTrades: threeClosedTrades() },
    });
    expect(result.weightedEntry.setupScore).toBe(70);
  });

  it("applies no-market-data penalty when market context is unavailable", () => {
    const result = evaluateEntryDecision({
      plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      marketContext: { status: "UNAVAILABLE" },
      behaviorContext: { status: "VALID", flags: [], closedTrades: threeClosedTrades() },
    });
    expect(result.reasons).toContain("MARKET_DATA_UNAVAILABLE");
    expect(result.weightedEntry.marketScore).toBe(80);
  });

  it("uses conflicted market score when consensus is AVOID", () => {
    const result = evaluateEntryDecision({
      plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      marketContext: { status: "VALID", consensusVerdict: "AVOID" },
      behaviorContext: { status: "VALID", flags: [], closedTrades: threeClosedTrades() },
    });
    expect(result.reasons).toContain("MARKET_CONSENSUS_AVOID");
    expect(result.weightedEntry.marketScore).toBe(30);
  });

  it("uses aligned market score when data is available and not AVOID", () => {
    const result = evaluateEntryDecision({
      plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      marketContext: { status: "VALID", consensusVerdict: "BUY" },
      behaviorContext: { status: "VALID", flags: [], closedTrades: threeClosedTrades() },
    });
    expect(result.weightedEntry.marketScore).toBe(95);
  });

  it("uses discipline score from behavior profile when present", () => {
    const t0 = Date.now();
    const closed = [
      { symbol: "A", entryTime: t0 - 400_000, exitTime: t0 - 390_000, pnlPaise: 100 },
      { symbol: "B", entryTime: t0 - 380_000, exitTime: t0 - 370_000, pnlPaise: 50 },
      { symbol: "C", entryTime: t0 - 360_000, exitTime: t0 - 350_000, pnlPaise: 80 },
    ];
    const result = evaluateEntryDecision({
      plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      marketContext: { status: "VALID", consensusVerdict: "BUY" },
      behaviorContext: { status: "VALID", flags: [], closedTrades: closed },
    });
    expect(result.behaviorProfile.success).toBe(true);
    expect(result.behaviorProfile.disciplineScore).not.toBeNull();
    expect(result.weightedEntry.behaviorScore).toBe(
      Math.max(0, Math.min(100, Number(result.behaviorProfile.disciplineScore)))
    );
  });

  it("scores behavior 70 when history is insufficient (1 trade)", () => {
    const t0 = Date.now();
    const closed = [{ symbol: "A", entryTime: t0 - 100_000, exitTime: t0 - 90_000, pnlPaise: 10 }];
    const result = evaluateEntryDecision({
      plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      marketContext: { status: "VALID", consensusVerdict: "BUY" },
      behaviorContext: { status: "VALID", flags: [], closedTrades: closed },
    });
    expect(result.behaviorProfile.reason).toBe("INSUFFICIENT_BEHAVIOR_HISTORY");
    expect(result.weightedEntry.behaviorScore).toBe(70);
  });

  it("applies FOMO_ENTRY and PANIC_EXIT and CHASING_PRICE flag penalties", () => {
    const result = evaluateEntryDecision({
      plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      marketContext: { status: "VALID", consensusVerdict: "BUY" },
      behaviorContext: {
        status: "VALID",
        flags: ["FOMO_ENTRY", "PANIC_EXIT", "CHASING_PRICE"],
        closedTrades: threeClosedTrades(),
      },
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining(["FOMO_ENTRY", "PANIC_EXIT_HISTORY", "CHASING_PRICE"])
    );
    expect(result.weightedEntry.marketScore).toBeLessThan(95);
  });

  it("applies intraday FOMO window penalty using IST entry time", () => {
    const entryTime = new Date("2024-06-15T09:40:00.000Z");
    const result = evaluateEntryDecision({
      plan: { side: "BUY", productType: "INTRADAY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      marketContext: { status: "VALID", consensusVerdict: "BUY" },
      behaviorContext: { status: "VALID", flags: [], closedTrades: threeClosedTrades() },
      entryTime: entryTime.toISOString(),
    });
    expect(getSquareoffMinutesIst).toHaveBeenCalled();
    expect(result.reasons).toContain("INTRADAY_FOMO_WINDOW");
  });

  it("pushes LOW_RR_PENALTY when implicit setup uses sub-threshold RR vs INTEL_LOW_RR_THRESHOLD", () => {
    const result = evaluateEntryDecision({
      plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9700, targetPricePaise: 10390 },
      marketContext: { status: "VALID", consensusVerdict: "BUY" },
      behaviorContext: { status: "VALID", flags: [], closedTrades: threeClosedTrades() },
    });
    expect(result.planValidation.isValid).toBe(true);
    expect(result.reasons).toContain("LOW_RR_PENALTY");
  });
});
