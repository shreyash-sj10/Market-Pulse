const mongoose = require("mongoose");
require("dotenv").config({ path: ".env" });
const request = require("supertest");
const jwt = require("jsonwebtoken");
jest.setTimeout(60000);
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/trading_platform_test";
const runIfDb = process.env.REQUIRE_DB_TESTS === "1" ? describe : describe.skip;

jest.mock("../../src/services/marketData.service", () => ({
  validateSymbol: jest.fn().mockImplementation(
    async () => new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          isValid: true,
          symbol: "TEST",
          data: { pricePaise: 10000, source: "REAL", isFallback: false },
        });
      }, 150);
    })
  ),
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
const Holding = require("../../src/models/holding.model");
const Trade = require("../../src/models/trade.model");
const ExecutionLock = require("../../src/models/executionLock.model");
const tradeService = require("../../src/services/trade.service");
const { issueDecisionToken, __testables } = require("../../src/services/intelligence/preTradeAuthority.store");
const PreTradeToken = require("../../src/models/preTradeToken.model");
const app = require("../../src/app");

runIfDb("Concurrency + Full Flow Verification", () => {
  let user;
  let authToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    }
    await ExecutionLock.syncIndexes();
    await PreTradeToken.syncIndexes();
  });

  beforeEach(async () => {
    await __testables.clearStore();
    await ExecutionLock.deleteMany({});
    await Holding.deleteMany({});
    await Trade.deleteMany({ symbol: /^(PARA_BUY|PARA_SELL|FLOW_TEST)\.NS$/ });
    await User.deleteMany({ email: "concurrency@pulse.local" });

    user = await User.create({
      name: "Concurrency Tester",
      email: "concurrency@pulse.local",
      password: "securepass",
      balance: 50_000_000,
    });
    authToken = jwt.sign(
      { userId: user._id, tokenType: "access" },
      process.env.JWT_SECRET || "default_secret"
    );
  });

  afterAll(async () => {
    await __testables.clearStore();
    await ExecutionLock.deleteMany({});
    await Holding.deleteMany({});
    await Trade.deleteMany({ symbol: /^(PARA_BUY|PARA_SELL|FLOW_TEST)\.NS$/ });
    await User.deleteMany({ email: "concurrency@pulse.local" });
    await mongoose.connection.close();
  });

  it("duplicate BUY execution allows one success and blocks duplicates", async () => {
    const requestId = "idem-buy-parallel";
    const payload = {
      symbol: "PARA_BUY",
      side: "BUY",
      quantity: 1,
      pricePaise: 10000,
      stopLossPaise: 9000,
      targetPricePaise: 12000,
      userThinking: "Parallel buy test",
      decisionContext: { stage: "PARALLEL_TEST" },
    };

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        (async () => {
          const authority = await issueDecisionToken({
            symbol: payload.symbol,
            pricePaise: payload.pricePaise,
            quantity: payload.quantity,
            stopLossPaise: payload.stopLossPaise,
            targetPricePaise: payload.targetPricePaise,
            verdict: "BUY",
            userId: user._id,
          });
          return request(app)
            .post("/api/trades/buy")
            .set("Authorization", `Bearer ${authToken}`)
            .set("idempotency-key", requestId)
            .set("pre-trade-token", authority.token)
            .send(payload);
        })()
      )
    );

    const success = results.filter((r) => r.status === "fulfilled" && r.value?.status === 201);
    const duplicates = results.filter(
      (r) => r.status === "fulfilled" && r.value?.status === 409 && r.value?.body?.message === "DUPLICATE_EXECUTION_BLOCKED"
    );

    expect(success.length).toBe(1);
    expect(duplicates.length).toBe(4);

    const buyCount = await Trade.countDocuments({ user: user._id, symbol: "PARA_BUY.NS", type: "BUY" });
    expect(buyCount).toBe(1);
  });

  it("duplicate SELL execution allows one success and blocks duplicates", async () => {
    await Trade.create({
      user: user._id,
      symbol: "PARA_SELL.NS",
      type: "BUY",
      quantity: 5,
      pricePaise: 10000,
      totalValuePaise: 50000,
      stopLossPaise: 9000,
      targetPricePaise: 12000,
      rr: 2,
      entryPlan: {
        entryPricePaise: 10000,
        stopLossPaise: 9000,
        targetPricePaise: 12000,
        rr: 2,
        intent: "Breakout",
        reasoning: "Seed entry trade",
      },
      decisionSnapshot: { verdict: "BUY", score: 90, pillars: {} },
    });

    await Holding.create({
      userId: user._id,
      symbol: "PARA_SELL.NS",
      quantity: 5,
      avgPricePaise: 10000,
    });

    const requestId = "idem-sell-parallel";
    const payload = {
      symbol: "PARA_SELL",
      side: "SELL",
      quantity: 5,
      pricePaise: 11000,
      userThinking: "Parallel sell test",
      decisionContext: { stage: "PARALLEL_EXIT" },
    };

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        (async () => {
          const authority = await issueDecisionToken({
            symbol: payload.symbol,
            pricePaise: payload.pricePaise,
            quantity: payload.quantity,
            stopLossPaise: null,
            targetPricePaise: null,
            verdict: "BUY",
            userId: user._id,
          });
          return request(app)
            .post("/api/trades/sell")
            .set("Authorization", `Bearer ${authToken}`)
            .set("idempotency-key", requestId)
            .set("pre-trade-token", authority.token)
            .send(payload);
        })()
      )
    );

    const success = results.filter((r) => r.status === "fulfilled" && r.value?.status === 201);
    const duplicates = results.filter(
      (r) => r.status === "fulfilled" && r.value?.status === 409 && r.value?.body?.message === "DUPLICATE_EXECUTION_BLOCKED"
    );

    expect(success.length).toBe(1);
    expect(duplicates.length).toBe(4);

    const sellCount = await Trade.countDocuments({ user: user._id, symbol: "PARA_SELL.NS", type: "SELL" });
    expect(sellCount).toBe(1);
  });

  it("full BUY -> SELL flow creates reflection output and updates skill snapshot", async () => {
    const buyPayload = {
      symbol: "FLOW_TEST",
      quantity: 2,
      pricePaise: 10000,
      stopLossPaise: 9000,
      targetPricePaise: 12000,
      userThinking: "Enter flow position",
      decisionContext: { stage: "FLOW_BUY" },
      requestId: "flow-buy-1",
    };

    const buyAuthority = await issueDecisionToken({
      symbol: buyPayload.symbol,
      pricePaise: buyPayload.pricePaise,
      quantity: buyPayload.quantity,
      stopLossPaise: buyPayload.stopLossPaise,
      targetPricePaise: buyPayload.targetPricePaise,
      verdict: "BUY",
      userId: user._id,
    });

    const buyResult = await tradeService.executeBuyTrade(user, {
      ...buyPayload,
      token: buyAuthority.token,
    });

    expect(buyResult.trade.type).toBe("BUY");

    const sellPayload = {
      symbol: "FLOW_TEST",
      quantity: 2,
      pricePaise: 11500,
      userThinking: "Exit flow position",
      decisionContext: { stage: "FLOW_SELL" },
      requestId: "flow-sell-1",
    };

    const sellAuthority = await issueDecisionToken({
      symbol: sellPayload.symbol,
      pricePaise: sellPayload.pricePaise,
      quantity: sellPayload.quantity,
      stopLossPaise: null,
      targetPricePaise: null,
      verdict: "BUY",
      userId: user._id,
    });

    const sellResult = await tradeService.executeSellTrade(user, {
      ...sellPayload,
      token: sellAuthority.token,
    });

    expect(sellResult.trade.type).toBe("SELL");
    expect(sellResult.trade.learningOutcome).toBeTruthy();
    expect(sellResult.trade.learningOutcome.verdict).toBeTruthy();

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.analyticsSnapshot).toBeTruthy();
    expect(typeof updatedUser.analyticsSnapshot.skillScore).toBe("number");
    expect(updatedUser.analyticsSnapshot.lastUpdated).toBeTruthy();
  });
});

