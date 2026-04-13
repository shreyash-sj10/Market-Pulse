jest.mock("../../src/services/aiExplanation.service", () => ({
  generateFinalTradeCall: jest.fn(),
}));

jest.mock("../../src/models/trace.model", () => ({
  create: jest.fn().mockResolvedValue({}),
}));

const aiService = require("../../src/services/aiExplanation.service");
const { generateFinalTradeCall } = require("../../src/services/decision.engine");
const { SYSTEM_STATE } = require("../../src/constants/systemState");

describe("decision.engine state modeling", () => {
  it("returns PARTIAL when required inputs are missing", async () => {
    const result = await generateFinalTradeCall(null, null, null);
    expect(result.state).toBe(SYSTEM_STATE.PARTIAL);
  });

  it("returns COMPLETE when full inputs are present and AI status is VALID", async () => {
    aiService.generateFinalTradeCall.mockResolvedValue({
      status: "VALID",
      suggestedAction: "BUY",
      finalCall: "BUY",
      reasoning: "Inputs validated.",
      confidence: 88,
    });

    const result = await generateFinalTradeCall(
      {
        setupScore: 82,
        totalValuePaise: 300000,
        balance: 2000000,
        stopLossPaise: 245000,
        targetPricePaise: 285000,
        pricePaise: 250000,
        strategy: "BREAKOUT",
        reason: "Momentum + volume confirmation",
      },
      {
        confidence: 78,
        impact: "BULLISH",
        mechanism: "Sector breadth expansion",
      },
      {
        dominantMistake: "NONE",
        consistencyScore: 92,
        summary: "Stable execution profile",
      }
    );

    expect(result.state).toBe(SYSTEM_STATE.COMPLETE);
    expect(result.verdict).toBeDefined();
    expect(Array.isArray(result.reasons)).toBe(true);
  });
});

