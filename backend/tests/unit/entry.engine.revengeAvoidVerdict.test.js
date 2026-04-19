/**
 * Covers the REVENGE + market AVOID → forced BLOCK branch after composite scoring.
 * Requires reloading system.config with relaxed boundaries so composite can be ALLOW first.
 */
describe("entry.engine revenge+AVOID verdict override", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
    jest.resetModules();
  });

  it("forces BLOCK when revenge flag meets consensus AVOID even if composite is ALLOW", () => {
    process.env.INTEL_AVOID_BOUNDARY = "40";
    process.env.INTEL_WAIT_BOUNDARY = "47";
    jest.resetModules();
    const { evaluateEntryDecision } = require("../../src/engines/entry.engine");

    const t0 = Date.now();
    const closedTrades = [
      { symbol: "A", entryTime: t0 - 200_000, exitTime: t0 - 190_000, pnlPaise: 100 },
      { symbol: "B", entryTime: t0 - 180_000, exitTime: t0 - 170_000, pnlPaise: 50 },
      { symbol: "C", entryTime: t0 - 160_000, exitTime: t0 - 150_000, pnlPaise: 80 },
    ];

    const result = evaluateEntryDecision({
      plan: {
        side: "BUY",
        pricePaise: 10000,
        stopLossPaise: 9000,
        targetPricePaise: 12000,
      },
      marketContext: {
        status: "VALID",
        consensusVerdict: "AVOID",
        strategyValid: true,
        adaptedRiskLevel: "LOW",
      },
      behaviorContext: {
        status: "VALID",
        flags: ["REVENGE_TRADING_RISK"],
        closedTrades,
      },
    });

    expect(result.verdict).toBe("BLOCK");
    expect(result.reasons).toContain("REVENGE_TRADING_RISK");
  });
});
