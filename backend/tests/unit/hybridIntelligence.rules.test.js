const { applyDeterministicRules } = require("../../src/services/news/hybridIntelligence.service");

describe("hybridIntelligence.applyDeterministicRules", () => {
  it("dedupes identical headlines so confidence is not stacked", () => {
    const dup = {
      event: "Same Headline Here",
      impact: "BULLISH",
      confidence: 80,
      scope: "STOCK",
    };
    const consensusSignals = [dup, { ...dup, confidence: 60 }, { ...dup, confidence: 70 }];
    const out = applyDeterministicRules(consensusSignals, { status: "VALID", sentimentScore: 0 });
    expect(out.status).toBe("VALID");
    expect(out.riskWarnings.some((w) => w.includes("Single transmission"))).toBe(true);
  });
});
