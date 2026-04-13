jest.mock("../../models/user.model", () => ({
  findById: jest.fn(),
}));

jest.mock("../../models/trade.model", () => {
  const leanContent = jest.fn();
  const sortContent = jest.fn().mockReturnValue({ lean: leanContent });
  return {
    create: jest.fn(),
    findOne: jest.fn().mockReturnValue({ sort: sortContent }),
    countDocuments: jest.fn(),
  };
});

jest.mock("../../models/trace.model", () => ({
  create: jest.fn(),
}));

jest.mock("../../models/executionLock.model", () => ({
  create: jest.fn().mockResolvedValue({}),
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
  deleteOne: jest.fn().mockResolvedValue({}),
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
const ExecutionLock = require("../../models/executionLock.model");
const preTradeAuthorityStore = require("../../services/intelligence/preTradeAuthority.store");
const { executeBuyTrade, executeSellTrade } = require("../trade.service");

describe("executeBuyTrade plan enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks BUY when pre-trade token is missing", async () => {
    await expect(
      executeBuyTrade({ _id: "user-1" }, { symbol: "TCS", type: "BUY", quantity: 1, pricePaise: 10000 })
    ).rejects.toMatchObject({ message: "REQUEST_ID_REQUIRED", statusCode: 400 });

    expect(User.findById).not.toHaveBeenCalled();
  });

  it("blocks BUY when idempotency key exists but pre-trade token is missing", async () => {
    await expect(
      executeBuyTrade(
        { _id: "user-1" },
        { symbol: "TCS", type: "BUY", quantity: 1, pricePaise: 10000, requestId: "idem-1" }
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
          type: "BUY",
          quantity: 1,
          pricePaise: 10000,
          stopLossPaise: 9800,
          targetPricePaise: 10400,
          token: "tok-1",
          requestId: "idem-2",
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
          type: "BUY",
          quantity: 1,
          pricePaise: 10000,
          stopLossPaise: 9800,
          targetPricePaise: 10400,
          token: "tok-2",
          requestId: "idem-3",
        }
      )
    ).rejects.toMatchObject({ message: "TRADE_BLOCKED_BY_DECISION_ENGINE", statusCode: 400 });

    expect(User.findById).not.toHaveBeenCalled();
  });
});

describe("executeSellTrade execution enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks SELL when pre-trade token is missing", async () => {
    await expect(
      executeSellTrade(
        { _id: "user-1" },
        { symbol: "TCS", type: "SELL", quantity: 1, pricePaise: 10000, requestId: "sell-idem-1" }
      )
    ).rejects.toMatchObject({ message: "PRE_TRADE_REQUIRED", statusCode: 400 });

    expect(User.findById).not.toHaveBeenCalled();
  });

  it("blocks SELL when reviewed payload is modified", async () => {
    preTradeAuthorityStore.getDecisionRecord.mockReturnValue({
      payloadHash: "reviewed-hash",
      verdict: "WAIT",
      expiresAt: Date.now() + 60000,
    });
    preTradeAuthorityStore.buildPayloadHash.mockReturnValue("different-hash");

    await expect(
      executeSellTrade(
        { _id: "user-1" },
        {
          symbol: "TCS",
          type: "SELL",
          quantity: 1,
          pricePaise: 10000,
          token: "sell-tok-1",
          requestId: "sell-idem-2",
        }
      )
    ).rejects.toMatchObject({ message: "PAYLOAD_MISMATCH", statusCode: 400 });

    expect(User.findById).not.toHaveBeenCalled();
  });
});
