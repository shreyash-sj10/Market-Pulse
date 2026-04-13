const {
  evaluateEntryDecision,
  mapDecisionVerdictToAuthorityVerdict,
} = require("../../src/engines/entry.engine");

describe("entry.engine", () => {
  it("returns ALLOW for a valid entry plan", () => {
    const result = evaluateEntryDecision({
      plan: {
        side: "BUY",
        pricePaise: 10000,
        stopLossPaise: 9000,
        targetPricePaise: 12000,
      },
      marketContext: {
        consensusVerdict: "BUY",
        strategyValid: true,
        adaptedRiskLevel: "MEDIUM",
      },
      behaviorContext: { flags: [] },
    });

    expect(result.verdict).toBe("ALLOW");
    expect(result.riskScore).toBeGreaterThanOrEqual(70);
    expect(mapDecisionVerdictToAuthorityVerdict(result.verdict)).toBe("BUY");
  });

  it("returns BLOCK when RR is below minimum threshold", () => {
    const result = evaluateEntryDecision({
      plan: {
        side: "BUY",
        pricePaise: 10000,
        stopLossPaise: 9500,
        targetPricePaise: 10400,
      },
      marketContext: {
        consensusVerdict: "BUY",
        strategyValid: true,
      },
      behaviorContext: { flags: [] },
    });

    expect(result.verdict).toBe("BLOCK");
    expect(result.reasons).toContain("INVALID_RR");
    expect(mapDecisionVerdictToAuthorityVerdict(result.verdict)).toBe("AVOID");
  });

  it("returns BLOCK for revenge trading risk with adverse consensus", () => {
    const result = evaluateEntryDecision({
      plan: {
        side: "BUY",
        pricePaise: 10000,
        stopLossPaise: 9000,
        targetPricePaise: 12000,
      },
      marketContext: {
        consensusVerdict: "AVOID",
        strategyValid: true,
        adaptedRiskLevel: "MEDIUM",
      },
      behaviorContext: { flags: ["REVENGE_TRADING_RISK"] },
    });

    expect(result.verdict).toBe("BLOCK");
    expect(result.reasons).toContain("REVENGE_TRADING_RISK");
    expect(result.behaviorFlags).toContain("REVENGE_TRADING_RISK");
  });
});

