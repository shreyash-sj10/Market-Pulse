require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const User = require("../../src/models/user.model");
const Trade = require("../../src/models/trade.model");

const marketDataService = require("../../src/services/marketData.service");
const { getPrice } = require("../../src/services/price.engine");
const aiExplanationService = require("../../src/services/aiExplanation.service");
jest.mock("../../src/services/marketData.service");
jest.mock("../../src/services/price.engine", () => ({
  getPrice: jest.fn(),
}));
jest.mock("../../src/services/aiExplanation.service");
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
process.env.ALLOW_CLOSED_MARKET_EXECUTION = "true";
jest.setTimeout(120000);
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/trading_platform_test";

const FORBIDDEN_KEYS = new Set(["price", "stopLoss", "targetPrice", "rrRatio", "pnlPercentage"]);
const REQUIRED_PAISE_KEYS = new Set(["pricePaise", "stopLossPaise", "targetPricePaise"]);

const scanKeys = (value, path = "root", found = []) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanKeys(item, `${path}[${index}]`, found));
    return found;
  }
  if (!value || typeof value !== "object") return found;
  Object.keys(value).forEach((key) => {
    if (FORBIDDEN_KEYS.has(key)) {
      found.push(`${path}.${key}`);
    }
    scanKeys(value[key], `${path}.${key}`, found);
  });
  return found;
};

describe("contract enforcement", () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 20000 });
    }

    marketDataService.validateSymbol.mockResolvedValue({ isValid: true, data: { pricePaise: 2500 } });
    marketDataService.getLivePrices.mockResolvedValue({
      "RELIANCE.NS": { pricePaise: 2500, source: "REAL", isFallback: false },
    });
    getPrice.mockResolvedValue({
      pricePaise: 2500,
      source: "LIVE",
    });
    aiExplanationService.parseTradeIntent.mockResolvedValue({ status: "VALID", strategy: "Breakout", confidence: 90, keywords: [] });
    aiExplanationService.generateExplanation.mockResolvedValue({ status: "VALID", explanation: "Test", behaviorAnalysis: "Low risk" });
    aiExplanationService.generateFinalTradeCall.mockResolvedValue({ status: "VALID", finalCall: "BUY", confidence: 85, reasoning: "Test", suggestedAction: "BUY" });

    await User.deleteMany({ email: "contract-enforcement@pulse.local" });
    testUser = await User.create({
      name: "Contract Enforcement User",
      email: "contract-enforcement@pulse.local",
      password: "password",
      balance: 1000000,
    });
    authToken = jwt.sign(
      { userId: testUser._id, tokenType: "access" },
      process.env.JWT_SECRET || "provide_a_secure_random_string_here"
    );
  });

  afterAll(async () => {
    if (testUser?._id) await Trade.deleteMany({ user: testUser._id });
    await User.deleteMany({ email: "contract-enforcement@pulse.local" });
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  });

  it("blocks legacy response fields and keeps paise contract", async () => {
    const preRes = await request(app)
      .post("/api/intelligence/pre-trade")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        symbol: "RELIANCE",
        side: "BUY",
        quantity: 1,
        pricePaise: 2500,
        stopLossPaise: 2400,
        targetPricePaise: 2700,
        userThinking: "Contract test",
      });

    expect(preRes.status).toBe(200);
    const preTradeToken = preRes.body?.data?.token ?? preRes.body?.data?.authority?.token;

    const buyRes = await request(app)
      .post("/api/trades/buy")
      .set("Authorization", `Bearer ${authToken}`)
      .set("idempotency-key", "contract-buy-1")
      .set("pre-trade-token", preTradeToken)
      .send({
        symbol: "RELIANCE",
        side: "BUY",
        quantity: 1,
        pricePaise: 2500,
        stopLossPaise: 2400,
        targetPricePaise: 2700,
        preTradeEmotion: "DISCIPLINED",
        preTradeToken,
        decisionContext: { scope: "contract" },
        userThinking: "Contract test",
      });

    expect(buyRes.status).toBe(201);

    const [positionsRes, historyRes] = await Promise.all([
      request(app).get("/api/portfolio/positions").set("Authorization", `Bearer ${authToken}`),
      request(app).get("/api/trades").set("Authorization", `Bearer ${authToken}`),
    ]);

    expect(positionsRes.status).toBe(200);
    expect(historyRes.status).toBe(200);

    const violations = [
      ...scanKeys(buyRes.body, "buy"),
      ...scanKeys(positionsRes.body, "positions"),
      ...scanKeys(historyRes.body, "history"),
    ];

    expect(violations).toEqual([]);

    const trade = buyRes.body.data;
    REQUIRED_PAISE_KEYS.forEach((key) => {
      expect(trade[key]).not.toBeUndefined();
    });
  });
});
