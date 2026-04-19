const { applyDeterministicRules } = require("../../src/services/news/hybridIntelligence.service");
const { evaluateEntryDecision } = require("../../src/engines/entry.engine");
const { digestIntelligenceSlices } = require("../../src/services/intelligence/canonicalIntelligenceDigest");

describe("intelligence cross-layer consistency (Phase 3)", () => {
  it("produces identical canonical digest for equivalent market + entry representations", () => {
    const signals = [
      { event: "Alpha Corp beats estimates", impact: "BULLISH", confidence: 72, scope: "STOCK" },
      { event: "Sector demand improving", impact: "BULLISH", confidence: 68, scope: "SECTOR" },
    ];
    const ruleOut = applyDeterministicRules(signals, { status: "VALID", sentimentScore: 3, explanation: "x", keyDriver: "y" });

    const entryOut = evaluateEntryDecision({
      plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      marketContext: { status: "VALID", consensusVerdict: ruleOut.verdict, adaptedRiskLevel: "MEDIUM" },
      behaviorContext: { status: "VALID", flags: [], closedTrades: [] },
    });

    const d1 = digestIntelligenceSlices({
      ruleVerdict: entryOut.verdict === "ALLOW" ? "BUY" : entryOut.verdict === "BLOCK" ? "AVOID" : "WAIT",
      riskScore: entryOut.riskScore,
      marketVerdict: ruleOut.verdict,
      marketConfidence: ruleOut.confidenceScore,
      marketAlignment: "ALIGNED",
      sentiment10: typeof ruleOut.narrativeLean === "number" ? ruleOut.narrativeLean : 0,
      signalCount: signals.length,
      avgSignalConfidence: ruleOut.confidenceScore,
    });

    const d2 = digestIntelligenceSlices({
      ruleVerdict: entryOut.verdict === "ALLOW" ? "BUY" : entryOut.verdict === "BLOCK" ? "AVOID" : "WAIT",
      riskScore: entryOut.riskScore,
      marketVerdict: ruleOut.verdict,
      marketConfidence: ruleOut.confidenceScore,
      marketAlignment: "ALIGNED",
      sentiment10: typeof ruleOut.narrativeLean === "number" ? ruleOut.narrativeLean : 0,
      signalCount: signals.length,
      avgSignalConfidence: ruleOut.confidenceScore,
    });

    expect(d2.hash).toBe(d1.hash);
    expect(d1.canonical.uc).toBe(d2.canonical.uc);
  });

  it("softens strong hybrid verdicts when data policy triggers", () => {
    const one = [{ event: "Only headline", impact: "BULLISH", confidence: 90, scope: "STOCK" }];
    const out = applyDeterministicRules(one, { status: "UNAVAILABLE" });
    expect(out.verdict).toBe("WAIT");
    expect(out.riskWarnings.some((w) => String(w).includes("INSUFFICIENT_DATA"))).toBe(true);
  });
});
