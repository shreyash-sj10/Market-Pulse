const request = require("supertest");
process.env.NODE_ENV = "test";

jest.mock("../../src/services/news/news.engine", () => ({
  getProcessedNews: jest.fn().mockImplementation(async (sym) => ({
    symbol: sym || "",
    status: "VALID",
    signals: [
      {
        id: "jest-consensus",
        event: "Synthetic consensus for integration tests",
        verdict: "BUY",
        impact: "BULLISH",
        confidence: 80,
        sector: "GENERAL",
        mechanism: "TEST_STUB",
        isConsensus: true,
        status: "VALID",
      },
    ],
    stats: { total: 1, lastUpdated: new Date().toISOString() },
  })),
}));

jest.mock("../../src/services/marketData.service", () => ({
  validateSymbol: jest.fn().mockResolvedValue({ isValid: true, pricePaise: 1_000_000 }),
  getLivePrices: jest.fn().mockResolvedValue({}),
  getLivePrice: jest.fn().mockResolvedValue(1_000_000),
  resolvePrice: jest.fn(),
}));

jest.mock("../../src/services/price.engine", () => ({
  getPrice: jest.fn().mockImplementation(async (sym) => {
    const s = String(sym || "").toUpperCase();
    if (s.includes("DRIFT")) {
      return { pricePaise: 1_000_000, source: "LIVE" };
    }
    return { pricePaise: 10000, source: "LIVE" };
  }),
}));

const app = require("../../src/app");
const mongoose = require("mongoose");
const User = require("../../src/models/user.model");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

require("dotenv").config();
const mongoUri =
  process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/trading_platform_test";

describe("PRICE_STALE slippage guard", () => {
  let userToken;

  beforeAll(async () => {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
    let user = await User.findOne({ email: "price-stale-tester@test.local" });
    if (!user) {
      user = await User.create({
        name: "Price Stale Tester",
        email: "price-stale-tester@test.local",
        password: "password123",
        balance: 100_000_000,
        realizedPnL: 0,
      });
    } else {
      user.balance = 100_000_000;
      await user.save();
    }
    userToken = jwt.sign(
      { userId: user._id, tokenType: "access" },
      process.env.JWT_SECRET || "default_secret"
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("rejects buy when client price is >0.5% away from live (422 PRICE_STALE)", async () => {
    const symbol = "DRIFTTEST.NS";
    const pre = await request(app)
      .post("/api/intelligence/pre-trade")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        symbol,
        side: "BUY",
        quantity: 1,
        pricePaise: 970_000,
        stopLossPaise: 900_000,
        targetPricePaise: 1_100_000,
        userThinking: "test drift",
      });

    expect(pre.status).toBe(200);
    const token = pre.body.data?.token ?? pre.body.data?.authority?.token;

    const buyRes = await request(app)
      .post("/api/trades/buy")
      .set("Authorization", `Bearer ${userToken}`)
      .set("idempotency-key", randomUUID())
      .set("pre-trade-token", token)
      .send({
        symbol,
        side: "BUY",
        quantity: 1,
        pricePaise: 970_000,
        stopLossPaise: 900_000,
        targetPricePaise: 1_100_000,
        preTradeEmotion: "CALM",
        preTradeToken: token,
        userThinking: "test drift",
      });

    expect(buyRes.status).toBe(422);
    expect(buyRes.body.code || buyRes.body.error?.code).toBe("PRICE_STALE");
  });
});
