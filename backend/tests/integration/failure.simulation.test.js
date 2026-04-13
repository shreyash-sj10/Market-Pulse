const { analyzeMarketIntelligence } = require("../../src/engines/marketIntelligence.engine");
const { generateExplanation } = require("../../src/services/aiExplanation.service");

jest.mock("../../src/models/user.model", () => ({
  findById: jest.fn(),
}));

jest.mock("../../src/models/trade.model", () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  findOne: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn() }) })
}));

jest.mock("../../src/models/executionLock.model", () => ({
  create: jest.fn().mockResolvedValue({}),
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
  deleteOne: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../src/utils/transaction", () => ({
  runInTransaction: jest.fn(async () => {
    throw new Error("DB_WRITE_FAILURE");
  }),
}));

const ExecutionLock = require("../../src/models/executionLock.model");
const { executeBuyTrade } = require("../../src/services/trade.service");

describe("failure simulation", () => {
  it("returns UNAVAILABLE when market data is missing", async () => {
    const result = await analyzeMarketIntelligence([], "NIFTY");
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reason).toBe("INSUFFICIENT_MARKET_DATA");
  });

  it("returns UNAVAILABLE when AI service is unavailable", async () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const result = await generateExplanation(45, ["OVERTRADING"], {
      symbol: "TCS.NS",
      type: "BUY",
    });

    process.env.GEMINI_API_KEY = original;
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reason).toBe("AI_UNAVAILABLE");
  });

  it("fails loudly when DB write fails during buy execution", async () => {
    await expect(
      executeBuyTrade(
        { _id: "507f1f77bcf86cd799439011" },
        {
          requestId: "db-failure-test",
          symbol: "RELIANCE",
          quantity: 1,
          pricePaise: 10000,
          stopLossPaise: 9000,
          targetPricePaise: 12000,
          token: "pretrade-token",
        }
      )
    ).rejects.toThrow("DB_WRITE_FAILURE");

    expect(ExecutionLock.deleteOne).toHaveBeenCalledWith({
      requestId: "db-failure-test",
      status: "PENDING",
    });
  });
});
