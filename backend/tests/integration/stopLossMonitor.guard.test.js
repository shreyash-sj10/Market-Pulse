process.env.NODE_ENV = "test";

jest.mock("../../src/services/marketHours.service", () => {
  const actual = jest.requireActual("../../src/services/marketHours.service");
  return {
    ...actual,
    isMarketOpen: jest.fn(() => true),
    isSquareoffWindowEligible: jest.fn(() => false),
  };
});

jest.mock("../../src/services/marketData.service", () => ({
  getLivePrices: jest.fn().mockResolvedValue({
    SLGUARD: { pricePaise: 40000, source: "MOCK" },
  }),
}));

const marketDataService = require("../../src/services/marketData.service");
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const User = require("../../src/models/user.model");
const Holding = require("../../src/models/holding.model");
const Trade = require("../../src/models/trade.model");
const tradeService = require("../../src/services/trade.service");
const stopLossMonitor = require("../../src/services/stopLossMonitor.service");
const { buildSystemRequestId } = require("../../src/utils/systemRequestId");

require("dotenv").config();
const mongoUri =
  process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/trading_platform_test";

describe("stop loss monitor double-cycle guard", () => {
  let user;

  beforeAll(async () => {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    user = await User.create({
      name: "SL Monitor Test",
      email: `sl-${Date.now()}@test.local`,
      password: "password123",
      balance: 50_000_000,
    });
    await Holding.create({
      userId: user._id,
      symbol: "SLGUARD",
      quantity: 5,
      avgPricePaise: 100000,
      tradeType: "DELIVERY",
    });
    await Trade.create({
      user: user._id,
      symbol: "SLGUARD",
      type: "BUY",
      productType: "DELIVERY",
      status: "EXECUTED",
      quantity: 5,
      pricePaise: 100000,
      totalValuePaise: 500000,
      stopLossPaise: 50000,
      targetPricePaise: 200000,
      priceSource: "REAL",
      idempotencyKey: `sl-buy-${randomUUID()}`,
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    marketDataService.getLivePrices.mockResolvedValue({
      SLGUARD: { pricePaise: 40000, source: "MOCK" },
    });
    await Trade.deleteMany({ user: user._id });
    await Holding.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
  });

  it("fires executeSellTrade once; second cycle sees pending SELL and skips", async () => {
    const spy = jest.spyOn(tradeService, "executeSellTrade").mockImplementation(async (u, payload) => {
      await Trade.create({
        user: u._id,
        symbol: payload.symbol,
        type: "SELL",
        productType: "DELIVERY",
        status: "PENDING_EXECUTION",
        quantity: payload.quantity,
        pricePaise: payload.pricePaise,
        totalValuePaise: payload.quantity * payload.pricePaise,
        priceSource: "REAL",
        idempotencyKey: `sl-sell-${randomUUID()}`,
      });
      return { trade: {}, updatedBalance: u.balance };
    });

    await stopLossMonitor.checkAllStopLosses();
    await stopLossMonitor.checkAllStopLosses();
    await stopLossMonitor.checkAllStopLosses();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1].requestId).toBe(
      buildSystemRequestId({ type: "SL", userId: user._id, symbol: "SLGUARD" })
    );
  });

  it("uses TARGET idempotency key when take-profit level is hit", async () => {
    marketDataService.getLivePrices.mockResolvedValue({
      SLGUARD: { pricePaise: 250000, source: "MOCK" },
    });

    const spy = jest.spyOn(tradeService, "executeSellTrade").mockResolvedValue({
      trade: {},
      updatedBalance: user.balance,
    });

    await stopLossMonitor.checkAllStopLosses();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1].requestId).toBe(
      buildSystemRequestId({ type: "TARGET", userId: user._id, symbol: "SLGUARD" })
    );
  });
});
