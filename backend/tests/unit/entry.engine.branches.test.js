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

describe("entry.engine uncovered branch scenarios", () => {
  const loadEvaluateEntryDecision = ({ analyzeBehaviorResult, squareoffMinutesIst = 930 }) => {
    jest.resetModules();
    jest.doMock("../../src/services/behavior.engine", () => ({
      analyzeBehavior: jest.fn(() => analyzeBehaviorResult),
    }));
    jest.doMock("../../src/services/marketHours.service", () => ({
      getSquareoffMinutesIst: jest.fn(() => squareoffMinutesIst),
    }));
    return require("../../src/engines/entry.engine").evaluateEntryDecision;
  };

  it("applies SELL default setup, no-market penalty, behavior penalties and intraday FOMO window", () => {
    const evaluateEntryDecisionWithMocks = loadEvaluateEntryDecision({
      analyzeBehaviorResult: { success: true, disciplineScore: 90 },
      squareoffMinutesIst: 930,
    });

    const result = evaluateEntryDecisionWithMocks({
      plan: { side: "SELL", productType: "INTRADAY" },
      marketContext: { status: "UNAVAILABLE", consensusVerdict: "BUY" },
      behaviorContext: {
        status: "VALID",
        flags: ["FOMO_ENTRY", "PANIC_EXIT", "CHASING_PRICE"],
        closedTrades: [{ pnlPaise: 100 }],
      },
      entryTime: "2026-01-01T09:40:00.000Z",
    });

    expect(result.weightedEntry.setupScore).toBe(70);
    expect(result.weightedEntry.marketScore).toBe(60);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "MARKET_DATA_UNAVAILABLE",
        "FOMO_ENTRY",
        "PANIC_EXIT_HISTORY",
        "CHASING_PRICE",
        "INTRADAY_FOMO_WINDOW",
      ])
    );
  });

  it("uses reduced behavior score when behavior history is insufficient", () => {
    const evaluateEntryDecisionWithMocks = loadEvaluateEntryDecision({
      analyzeBehaviorResult: { success: false, reason: "INSUFFICIENT_BEHAVIOR_HISTORY" },
    });

    const result = evaluateEntryDecisionWithMocks({
      plan: { side: "SELL", productType: "DELIVERY" },
      marketContext: { status: "VALID", consensusVerdict: "BUY" },
      behaviorContext: { status: "VALID", flags: [], closedTrades: [{ pnlPaise: 10 }] },
    });

    expect(result.weightedEntry.behaviorScore).toBe(70);
  });

  it("blocks revenge trading with AVOID consensus without duplicating reasons", () => {
    const previousVetoFloor = process.env.ENTRY_BEHAVIOR_VETO_FLOOR;
    try {
      process.env.ENTRY_BEHAVIOR_VETO_FLOOR = "10";
      const evaluateEntryDecisionWithMocks = loadEvaluateEntryDecision({
        analyzeBehaviorResult: { success: true, disciplineScore: 90 },
      });

      const result = evaluateEntryDecisionWithMocks({
        plan: { side: "SELL", productType: "DELIVERY" },
        marketContext: { status: "VALID", consensusVerdict: "AVOID" },
        behaviorContext: {
          status: "VALID",
          flags: ["REVENGE_TRADING_RISK"],
          closedTrades: [{ pnlPaise: -100 }],
        },
      });

      expect(result.verdict).toBe("BLOCK");
      expect(result.reasons.filter((reason) => reason === "REVENGE_TRADING_RISK")).toHaveLength(1);
    } finally {
      if (previousVetoFloor == null) delete process.env.ENTRY_BEHAVIOR_VETO_FLOOR;
      else process.env.ENTRY_BEHAVIOR_VETO_FLOOR = previousVetoFloor;
    }
  });
});
