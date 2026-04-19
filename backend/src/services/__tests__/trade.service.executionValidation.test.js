jest.mock("../../models/user.model", () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn().mockResolvedValue({ systemStateVersion: 1 }),
}));

jest.mock("../../models/trade.model", () => {
  const findSession = jest.fn().mockResolvedValue([]);
  const find = jest.fn().mockReturnValue({ session: findSession });
  const leanContent = jest.fn().mockResolvedValue(null);
  const sortContent = jest.fn().mockReturnValue({ lean: leanContent });
  return {
    create: jest.fn(),
    find,
    findOne: jest.fn().mockReturnValue({ sort: sortContent }),
    countDocuments: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
  };
});

jest.mock("../../models/trace.model", () => ({
  create: jest.fn(),
}));

jest.mock("../../models/preTradeToken.model", () => ({
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../models/executionLock.model", () => ({
  updateOne: jest.fn(),
  findOne: jest.fn(),
  deleteOne: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../services/marketData.service", () => ({
  validateSymbol: jest.fn().mockResolvedValue({ isValid: true }),
  resolvePrice: jest.fn(),
}));

jest.mock("../../services/price.engine", () => ({
  getPrice: jest.fn().mockResolvedValue({ pricePaise: 10000, source: "MEMORY" }),
}));

jest.mock("../../services/aiExplanation.service", () => ({
  generateExplanation: jest.fn(),
  parseTradeIntent: jest.fn(),
  generateFinalTradeCall: jest.fn(),
}));

jest.mock("../../utils/transaction", () => ({
  runInTransaction: jest.fn(async (work) => work({})),
}));

jest.mock("../../utils/redisClient", () => null);

jest.mock("../../services/intelligence/preTradeAuthority.store", () => ({
  buildPayloadHash: jest.fn(),
}));

const User = require("../../models/user.model");
const Trade = require("../../models/trade.model");
const ExecutionLock = require("../../models/executionLock.model");
const PreTradeToken = require("../../models/preTradeToken.model");
const preTradeAuthorityStore = require("../../services/intelligence/preTradeAuthority.store");
const {
  executeBuyTrade,
  executeSellTrade,
  __testables: { buildExecutionRequestHash },
} = require("../trade.service");

const actualPreTradeStore = jest.requireActual("../../services/intelligence/preTradeAuthority.store");

const buyPayload = {
  symbol: "TCS",
  type: "BUY",
  quantity: 1,
  pricePaise: 10000,
  stopLossPaise: 9800,
  targetPricePaise: 10400,
  token: "tok-1",
  requestId: "idem-2",
};

function setupHappyLockPath(requestHash) {
  ExecutionLock.findOne.mockImplementation((filter) => {
    if (filter && filter.status === "COMPLETED") {
      return { lean: jest.fn().mockResolvedValue(null) };
    }
    return {
      session: jest.fn().mockResolvedValue({
        userId: "user-1",
        requestPayloadHash: requestHash,
        status: "IN_PROGRESS",
        responseData: null,
      }),
    };
  });
  ExecutionLock.updateOne.mockResolvedValue({ upsertedCount: 1, matchedCount: 0, modifiedCount: 0 });
}

describe("executeBuyTrade plan enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    preTradeAuthorityStore.buildPayloadHash.mockImplementation(actualPreTradeStore.buildPayloadHash);
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
    const requestHash = buildExecutionRequestHash(buyPayload, "BUY");
    setupHappyLockPath(requestHash);
    PreTradeToken.findOneAndUpdate.mockResolvedValue({
      userId: "user-1",
      payloadHash: "reviewed-hash",
      verdict: "BUY",
      expiresAt: new Date(Date.now() + 60000),
    });
    preTradeAuthorityStore.buildPayloadHash.mockReturnValue("different-hash");

    await expect(executeBuyTrade({ _id: "user-1" }, buyPayload)).rejects.toMatchObject({
      message: "PAYLOAD_MISMATCH",
      statusCode: 400,
    });

    expect(User.findById).not.toHaveBeenCalled();
  });

  it("blocks BUY when pre-trade verdict is WAIT/AVOID", async () => {
    const requestHash = buildExecutionRequestHash(buyPayload, "BUY");
    setupHappyLockPath(requestHash);
    const payloadHashMatch = actualPreTradeStore.buildPayloadHash({
      symbol: buyPayload.symbol,
      pricePaise: buyPayload.pricePaise,
      quantity: buyPayload.quantity,
      stopLossPaise: buyPayload.stopLossPaise || null,
      targetPricePaise: buyPayload.targetPricePaise || null,
    });
    PreTradeToken.findOneAndUpdate.mockResolvedValue({
      userId: "user-1",
      payloadHash: payloadHashMatch,
      verdict: "WAIT",
      expiresAt: new Date(Date.now() + 60000),
    });

    await expect(executeBuyTrade({ _id: "user-1" }, buyPayload)).rejects.toMatchObject({
      message: "TRADE_BLOCKED_BY_DECISION_ENGINE",
      statusCode: 400,
    });

    expect(User.findById).not.toHaveBeenCalled();
  });
});

describe("executeSellTrade execution enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    preTradeAuthorityStore.buildPayloadHash.mockImplementation(actualPreTradeStore.buildPayloadHash);
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
    const sellPayload = {
      symbol: "TCS",
      type: "SELL",
      quantity: 1,
      pricePaise: 10000,
      token: "sell-tok-1",
      requestId: "sell-idem-2",
    };
    const requestHash = buildExecutionRequestHash(sellPayload, "SELL");
    setupHappyLockPath(requestHash);
    PreTradeToken.findOneAndUpdate.mockResolvedValue({
      userId: "user-1",
      payloadHash: "reviewed-hash",
      verdict: "WAIT",
      expiresAt: new Date(Date.now() + 60000),
    });
    preTradeAuthorityStore.buildPayloadHash.mockReturnValue("different-hash");

    await expect(executeSellTrade({ _id: "user-1" }, sellPayload)).rejects.toMatchObject({
      message: "PAYLOAD_MISMATCH",
      statusCode: 400,
    });

    expect(User.findById).not.toHaveBeenCalled();
  });

  it("blocks token replay when token user does not match authenticated user", async () => {
    const sellPayload = {
      symbol: "TCS",
      type: "SELL",
      quantity: 1,
      pricePaise: 10000,
      token: "sell-tok-2",
      requestId: "sell-idem-3",
    };
    const requestHash = buildExecutionRequestHash(sellPayload, "SELL");
    setupHappyLockPath(requestHash);
    PreTradeToken.findOneAndUpdate.mockResolvedValue(null);

    await expect(executeSellTrade({ _id: "user-1" }, sellPayload)).rejects.toMatchObject({
      message: "INVALID_TOKEN",
      statusCode: 400,
    });
  });
});
