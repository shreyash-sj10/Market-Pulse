jest.mock("../../models/user.model", () => ({
  findById: jest.fn(),
}));

jest.mock("../../models/trade.model", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../../models/trace.model", () => ({
  create: jest.fn(),
}));

jest.mock("../../services/marketData.service", () => ({
  validateSymbol: jest.fn().mockResolvedValue({ isValid: true }),
}));

jest.mock("../../services/aiExplanation.service", () => ({
  generateExplanation: jest.fn(),
  parseTradeIntent: jest.fn(),
  generateFinalTradeCall: jest.fn(),
}));

jest.mock("../../utils/transaction", () => ({
  runInTransaction: jest.fn(async (work) => work({})),
}));

jest.mock("../../services/intelligence/preTradeAuthority.store", () => ({
  buildPayloadHash: jest.fn(),
  getDecisionRecord: jest.fn(),
  consumeDecisionRecord: jest.fn(),
}));

const User = require("../../models/user.model");
const Trade = require("../../models/trade.model");
const preTradeAuthorityStore = require("../../services/intelligence/preTradeAuthority.store");
const { executeBuyTrade } = require("../trade.service");

describe("executeBuyTrade plan enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks BUY when pre-trade token is missing", async () => {
    await expect(
      executeBuyTrade({ _id: "user-1" }, { symbol: "TCS", quantity: 1, price: 10000 })
    ).rejects.toMatchObject({ message: "IDEMPOTENCY_KEY_REQUIRED", statusCode: 400 });

    expect(User.findById).not.toHaveBeenCalled();
  });

  it("blocks BUY when idempotency key exists but pre-trade token is missing", async () => {
    await expect(
      executeBuyTrade(
        { _id: "user-1" },
        { symbol: "TCS", quantity: 1, price: 10000, idempotencyKey: "idem-1" }
      )
    ).rejects.toMatchObject({ message: "PRE_TRADE_REQUIRED", statusCode: 400 });

    expect(User.findById).not.toHaveBeenCalled();
  });

  it("blocks BUY when reviewed payload is modified", async () => {
    preTradeAuthorityStore.getDecisionRecord.mockReturnValue({
      payloadHash: "reviewed-hash",
      verdict: "BUY",
      expiresAt: Date.now() + 60000,
    });
    preTradeAuthorityStore.buildPayloadHash.mockReturnValue("different-hash");

    await expect(
      executeBuyTrade(
        { _id: "user-1" },
        {
          symbol: "TCS",
          quantity: 1,
          price: 10000,
          stopLoss: 9800,
          targetPrice: 10400,
          token: "tok-1",
          idempotencyKey: "idem-2",
        }
      )
    ).rejects.toMatchObject({ message: "PAYLOAD_MISMATCH", statusCode: 400 });

    expect(User.findById).not.toHaveBeenCalled();
  });

  it("blocks BUY when pre-trade verdict is WAIT/AVOID", async () => {
    preTradeAuthorityStore.getDecisionRecord.mockReturnValue({
      payloadHash: "same-hash",
      verdict: "WAIT",
      expiresAt: Date.now() + 60000,
    });
    preTradeAuthorityStore.buildPayloadHash.mockReturnValue("same-hash");

    await expect(
      executeBuyTrade(
        { _id: "user-1" },
        {
          symbol: "TCS",
          quantity: 1,
          price: 10000,
          stopLoss: 9800,
          targetPrice: 10400,
          token: "tok-2",
          idempotencyKey: "idem-3",
        }
      )
    ).rejects.toMatchObject({ message: "TRADE_BLOCKED_BY_DECISION_ENGINE", statusCode: 400 });

    expect(User.findById).not.toHaveBeenCalled();
  });

  it("returns existing trade without creating duplicates for same idempotency key", async () => {
    const existingTrade = {
      _id: "trade-1",
      user: "user-1",
      symbol: "TCS.NS",
      type: "BUY",
      quantity: 1,
      pricePaise: 10000,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    Trade.findOne.mockResolvedValue(existingTrade);
    User.findById.mockResolvedValue({ balance: 4200 });

    const result = await executeBuyTrade(
      { _id: "user-1" },
      { symbol: "TCS", quantity: 1, price: 10000, idempotencyKey: "idem-dup" }
    );

    expect(result.trade.id).toBe("trade-1");
    expect(result.updatedBalance).toBe(4200);
    expect(Trade.create).not.toHaveBeenCalled();
  });

  it("returns the same normalized response for repeated requests with same idempotency key", async () => {
    const existingTrade = {
      _id: "trade-2",
      user: "user-1",
      symbol: "INFY.NS",
      type: "BUY",
      quantity: 2,
      pricePaise: 15000,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    };

    Trade.findOne.mockResolvedValue(existingTrade);
    User.findById.mockResolvedValue({ balance: 7777 });

    const payload = { symbol: "INFY", quantity: 2, price: 15000, idempotencyKey: "idem-repeat" };
    const first = await executeBuyTrade({ _id: "user-1" }, payload);
    const second = await executeBuyTrade({ _id: "user-1" }, payload);

    expect(second).toEqual(first);
    expect(Trade.create).not.toHaveBeenCalled();
  });
});
