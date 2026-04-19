const { evaluateEntryDecision } = require("../../src/engines/entry.engine");

describe("entry.engine weighted scoring", () => {
  const baseCtx = {
    plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
    marketContext: { status: "VALID", consensusVerdict: "BUY" },
    behaviorContext: { status: "VALID", flags: [] },
  };

  it("delivery: setup 80 market 85 behavior 75 → composite 80 → ALLOW", () => {
    const r = evaluateEntryDecision({
      ...baseCtx,
      plan: { ...baseCtx.plan, productType: "DELIVERY" },
      scores: { setup: 80, market: 85, behavior: 75 },
    });
    expect(r.weightedEntry.composite).toBe(80);
    expect(r.verdict).toBe("ALLOW");
  });

  it("intraday: same scores → composite 79 (different weights)", () => {
    const r = evaluateEntryDecision({
      ...baseCtx,
      plan: { ...baseCtx.plan, productType: "INTRADAY" },
      scores: { setup: 80, market: 85, behavior: 75 },
    });
    expect(r.weightedEntry.composite).toBe(79);
    expect(r.verdict).toBe("ALLOW");
  });

  it("behavior below veto floor → AVOID regardless of other scores", () => {
    const r = evaluateEntryDecision({
      ...baseCtx,
      scores: { setup: 95, market: 95, behavior: 15 },
    });
    expect(r.verdict).toBe("BLOCK");
    expect(r.reasons).toContain("BEHAVIORAL_VETO");
  });

  it("same explicit input 10× → identical composite and verdict", () => {
    const input = {
      ...baseCtx,
      plan: { ...baseCtx.plan, productType: "DELIVERY" },
      scores: { setup: 72, market: 68, behavior: 81 },
    };
    const first = evaluateEntryDecision(input);
    for (let i = 0; i < 9; i += 1) {
      const next = evaluateEntryDecision(input);
      expect(next.weightedEntry.composite).toBe(first.weightedEntry.composite);
      expect(next.verdict).toBe(first.verdict);
    }
  });
});
