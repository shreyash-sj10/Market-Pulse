const {
  evaluateEntryDecision,
  mapDecisionVerdictToAuthorityVerdict,
} = require("../../src/engines/entry.engine");

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
});
