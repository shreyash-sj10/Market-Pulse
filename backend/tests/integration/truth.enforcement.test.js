const fs = require("fs");
const path = require("path");
const { analyzeMarketIntelligence } = require("../../src/engines/marketIntelligence.engine");
const { generateExplanation } = require("../../src/services/aiExplanation.service");
const { evaluateEntryDecision } = require("../../src/engines/entry.engine");

describe("truth enforcement", () => {
  it("returns UNAVAILABLE when market data is missing", async () => {
    const result = await analyzeMarketIntelligence([], "NIFTY");
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reason).toBe("INSUFFICIENT_MARKET_DATA");
  });

  it("returns UNAVAILABLE when AI is unavailable", async () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const result = await generateExplanation(40, ["OVERTRADING"], {
      symbol: "TCS.NS",
      type: "BUY",
      reason: "test",
      userThinking: "test",
    });

    process.env.GEMINI_API_KEY = original;
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reason).toBe("AI_UNAVAILABLE");
  });

  it("blocks entry decision on partial input", () => {
    const result = evaluateEntryDecision({
      plan: { side: "BUY", pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 },
      marketContext: { status: "UNAVAILABLE", reason: "NO_MARKET_SIGNALS" },
      behaviorContext: { status: "VALID", flags: [] },
    });

    expect(result.verdict).toBe("BLOCK");
    expect(result.reasons).toContain("INSUFFICIENT_DATA");
  });

  it("contains no fake default confidence or score constants in intelligence paths", () => {
    const files = [
      path.join(__dirname, "../../src/services/aiExplanation.service.js"),
      path.join(__dirname, "../../src/services/news/news.engine.js"),
      path.join(__dirname, "../../src/engines/marketIntelligence.engine.js"),
      path.join(__dirname, "../../src/engines/entry.engine.js"),
      path.join(__dirname, "../../src/services/decision.engine.js"),
    ];

    const combined = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
    expect(combined).not.toMatch(/confidence:\s*0\./);
    expect(combined).not.toMatch(/score:\s*50\b/);
  });
});

