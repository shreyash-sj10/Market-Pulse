const mongoose = require("mongoose");
require("dotenv").config({ path: ".env" });

jest.mock("../../src/services/marketData.service", () => ({
  validateSymbol: jest.fn().mockResolvedValue({
    isValid: true,
    symbol: "TEST",
    data: { pricePaise: 10000, source: "REAL", isFallback: false },
  }),
  resolvePrice: jest.fn(),
}));

jest.mock("../../src/services/price.engine", () => ({
  getPrice: jest.fn().mockResolvedValue({
    pricePaise: 10000,
    source: "LIVE",
  }),
}));

jest.mock("../../src/services/aiExplanation.service", () => ({
  parseTradeIntent: jest.fn().mockResolvedValue({ strategy: "Breakout", confidence: 90 }),
  generateExplanation: jest.fn().mockResolvedValue({
    explanation: "Deterministic explanation",
    behaviorAnalysis: "Controlled behavior",
  }),
  generateFinalTradeCall: jest.fn().mockResolvedValue({ suggestedAction: "BUY", verdict: "BUY" }),
}));

const User = require("../../src/models/user.model");
const Trade = require("../../src/models/trade.model");
const Holding = require("../../src/models/holding.model");
const ExecutionLock = require("../../src/models/executionLock.model");
const PreTradeToken = require("../../src/models/preTradeToken.model");
const tradeService = require("../../src/services/trade.service");
const { issueDecisionToken, __testables } = require("../../src/services/intelligence/preTradeAuthority.store");
jest.setTimeout(60000);
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/trading_platform_test";

const buyPayload = (overrides = {}) => ({
  symbol: "HOLD_TEST",
  quantity: 1,
  pricePaise: 10000,
  stopLossPaise: 9000,
  targetPricePaise: 12000,
  preTradeEmotion: "CALM",
  userThinking: "Buy test",
  decisionContext: { stage: "BUY" },
  ...overrides,
});

const sellPayload = (overrides = {}) => ({
  symbol: "HOLD_TEST",
  quantity: 1,
  pricePaise: 10000,
  preTradeEmotion: "DISCIPLINED",
  userThinking: "Sell test",
  decisionContext: { stage: "SELL" },
  ...overrides,
});

// ── Async token helpers ───────────────────────────────────────────────────────
// issueDecisionToken is now DB-backed (async). These helpers must await it and
// return the token string so callers can: const token = await issueBuyToken(p)
const issueBuyToken = async (payload, userId) => {
  const r = await issueDecisionToken({
    symbol: payload.symbol,
    pricePaise: payload.pricePaise,
    quantity: payload.quantity,
    stopLossPaise: payload.stopLossPaise,
    targetPricePaise: payload.targetPricePaise,
    verdict: "BUY",
    userId: userId || null,
  });
  return r.token;
};

const issueSellToken = async (payload, userId) => {
  const r = await issueDecisionToken({
    symbol: payload.symbol,
    pricePaise: payload.pricePaise,
    quantity: payload.quantity,
    stopLossPaise: null,
    targetPricePaise: null,
    verdict: "BUY",
    userId: userId || null,
  });
  return r.token;
};

describe("Holdings collection integrity", () => {
  let user;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    }
    await Holding.syncIndexes();
    await PreTradeToken.syncIndexes();
  });

  beforeEach(async () => {
    await __testables.clearStore();
    await ExecutionLock.deleteMany({});
    await Holding.deleteMany({});
    await Trade.deleteMany({ symbol: "HOLD_TEST.NS" });
    await User.deleteMany({ email: "holdings-test@pulse.local" });

    user = await User.create({
      name: "Holdings Tester",
      email: "holdings-test@pulse.local",
      password: "securepass",
      balance: 50_000_000,
    });
  });

  afterAll(async () => {
    await __testables.clearStore();
    await ExecutionLock.deleteMany({});
    await Holding.deleteMany({});
    await Trade.deleteMany({ symbol: "HOLD_TEST.NS" });
    await User.deleteMany({ email: "holdings-test@pulse.local" });
    await mongoose.connection.close();
  });

  it("BUY creates holding", async () => {
    const payload = buyPayload({ requestId: "buy-create-1" });
    await tradeService.executeBuyTrade(user, { ...payload, token: await issueBuyToken(payload, user._id) });

    const holding = await Holding.findOne({ userId: user._id, symbol: "HOLD_TEST.NS" });
    expect(holding).toBeTruthy();
    expect(holding.quantity).toBe(1);
    expect(holding.avgPricePaise).toBe(10000);
  });

  it("BUY updates existing holding avgPricePaise", async () => {
    const first = buyPayload({ requestId: "buy-avg-1", quantity: 2, pricePaise: 10000 });
    const second = buyPayload({
      requestId: "buy-avg-2",
      quantity: 1,
      pricePaise: 10000,
      stopLossPaise: 9000,
      targetPricePaise: 12000,
    });

    await tradeService.executeBuyTrade(user, { ...first, token: await issueBuyToken(first, user._id) });
    await tradeService.executeBuyTrade(user, { ...second, token: await issueBuyToken(second, user._id) });

    const holding = await Holding.findOne({ userId: user._id, symbol: "HOLD_TEST.NS" });
    expect(holding.quantity).toBe(3);
    // Execution fill uses `getPrice` mock (10000 paise), not the limit price in the payload.
    expect(holding.avgPricePaise).toBe(10000);
  });

  it("SELL reduces quantity", async () => {
    const buy = buyPayload({ requestId: "buy-sell-reduce", quantity: 3 });
    await tradeService.executeBuyTrade(user, { ...buy, token: await issueBuyToken(buy, user._id) });

    const sell = sellPayload({ requestId: "sell-reduce", quantity: 1 });
    await tradeService.executeSellTrade(user, { ...sell, token: await issueSellToken(sell, user._id) });

    const holding = await Holding.findOne({ userId: user._id, symbol: "HOLD_TEST.NS" });
    expect(holding).toBeTruthy();
    expect(holding.quantity).toBe(2);
  });

  it("SELL deletes holding when quantity reaches zero", async () => {
    const buy = buyPayload({ requestId: "buy-sell-delete", quantity: 2 });
    await tradeService.executeBuyTrade(user, { ...buy, token: await issueBuyToken(buy, user._id) });

    const sell = sellPayload({ requestId: "sell-delete", quantity: 2 });
    await tradeService.executeSellTrade(user, { ...sell, token: await issueSellToken(sell, user._id) });

    const holding = await Holding.findOne({ userId: user._id, symbol: "HOLD_TEST.NS" });
    expect(holding).toBeNull();
  });

  it("SELL fails when quantity is insufficient", async () => {
    const buy = buyPayload({ requestId: "buy-insufficient", quantity: 1 });
    await tradeService.executeBuyTrade(user, { ...buy, token: await issueBuyToken(buy, user._id) });

    const sell = sellPayload({ requestId: "sell-insufficient", quantity: 2 });
    await expect(
      tradeService.executeSellTrade(user, { ...sell, token: await issueSellToken(sell, user._id) })
    ).rejects.toMatchObject({ message: "INSUFFICIENT_QUANTITY", statusCode: 400 });
  });

  it("parallel BUY updates same symbol without avgPrice corruption", async () => {
    const executeBuyWithRetry = async (payload, attempts = 3) => {
      let lastError = null;
      for (let i = 0; i < attempts; i += 1) {
        const attemptPayload = { ...payload, requestId: `${payload.requestId}-a${i + 1}` };
        try {
          return await tradeService.executeBuyTrade(user, {
            ...attemptPayload,
            token: await issueBuyToken(attemptPayload, user._id),
          });
        } catch (error) {
          lastError = error;
          if (error?.message !== "INVALID_TOKEN") {
            throw error;
          }
        }
      }
      throw lastError || new Error("PARALLEL_BUY_RETRY_EXHAUSTED");
    };

    const buys = [
      buyPayload({ requestId: "par-buy-1", quantity: 1, pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 }),
      buyPayload({ requestId: "par-buy-2", quantity: 2, pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 }),
      buyPayload({ requestId: "par-buy-3", quantity: 1, pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000 }),
    ];

    await Promise.all(
      buys.map((payload) => executeBuyWithRetry(payload))
    );

    const holding = await Holding.findOne({ userId: user._id, symbol: "HOLD_TEST.NS" });
    expect(holding.quantity).toBe(4);
    expect(holding.avgPricePaise).toBe(10000);
  });
});

