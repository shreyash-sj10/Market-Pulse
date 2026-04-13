const {
  calculateRR,
  validatePlan,
  getRiskScore,
  computePnlPct,
} = require("../../src/services/risk.engine");

describe("risk.engine determinism and correctness", () => {
  it("calculates RR correctly for valid BUY plan", () => {
    const rr = calculateRR(10000, 9500, 11000);
    expect(rr).toBe(2);
  });

  it("rejects invalid BUY plan where RR is below minimum", () => {
    const result = validatePlan({
      side: "BUY",
      pricePaise: 10000,
      stopLossPaise: 9800,
      targetPricePaise: 10200,
    });

    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe("INVALID_RR");
  });

  it("returns deterministic penalty score for low RR", () => {
    const input = {
      side: "BUY",
      pricePaise: 10000,
      stopLossPaise: 9800,
      targetPricePaise: 10200,
    };
    const scoreA = getRiskScore(input);
    const scoreB = getRiskScore(input);
    expect(scoreA).toBe(scoreB);
    expect(Number.isFinite(scoreA)).toBe(true);
  });

  it("rejects invalid side", () => {
    const result = validatePlan({
      side: "HOLD",
      pricePaise: 10000,
      stopLossPaise: 9000,
      targetPricePaise: 12000,
    });
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe("INVALID_SIDE");
  });

  it("rejects SELL with invalid directional targets", () => {
    const result = validatePlan({
      side: "SELL",
      pricePaise: 10000,
      stopLossPaise: 9000,
      targetPricePaise: 9500,
    });
    expect(result.isValid).toBe(false);
  });

  it("computes pnl pct with guardrails", () => {
    expect(computePnlPct(500, 10000)).toBe(5);
    expect(computePnlPct(500, 0)).toBe(0);
  });
});
