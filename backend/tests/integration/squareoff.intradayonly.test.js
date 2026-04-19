process.env.NODE_ENV = "test";

const mockGetLivePrices = jest.fn().mockResolvedValue({
  SQINTR: { pricePaise: 500000 },
});

jest.mock("../../src/services/marketData.service", () => ({
  getLivePrices: (...args) => mockGetLivePrices(...args),
}));

const mockExecuteSell = jest.fn().mockResolvedValue({ ok: true });

jest.mock("../../src/services/trade.service", () => ({
  executeSellTrade: (...args) => mockExecuteSell(...args),
  executeBuyTrade: jest.fn(),
  placeOrder: jest.fn(),
  executeOrder: jest.fn(),
}));

const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const User = require("../../src/models/user.model");
const Trade = require("../../src/models/trade.model");
const squareoffService = require("../../src/services/squareoff.service");
const { buildSystemRequestId } = require("../../src/utils/systemRequestId");

require("dotenv").config();
const mongoUri =
  process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/trading_platform_test";

describe("squareoff intraday scope", () => {
  let user;

  beforeAll(async () => {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    mockExecuteSell.mockClear();
    await Trade.deleteMany({ symbol: "SQINTR" });
    user = await User.create({
      name: "Sqoff Test",
      email: `sqoff-${Date.now()}@test.local`,
      password: "password123",
      balance: 50_000_000,
    });
  });

  afterEach(async () => {
    await Trade.deleteMany({ user: user._id });
    await User.deleteOne({ _id: user._id });
  });

  it("only liquidates INTRADAY BUY EXECUTED rows (delivery untouched)", async () => {
    await Trade.create([
      {
        user: user._id,
        symbol: "SQINTR",
        type: "BUY",
        productType: "DELIVERY",
        status: "EXECUTED",
        quantity: 2,
        pricePaise: 400000,
        totalValuePaise: 800000,
        priceSource: "REAL",
        idempotencyKey: `sqoff-del-${randomUUID()}`,
      },
      {
        user: user._id,
        symbol: "SQINTR",
        type: "BUY",
        productType: "INTRADAY",
        status: "EXECUTED",
        quantity: 3,
        pricePaise: 400000,
        totalValuePaise: 1_200_000,
        priceSource: "REAL",
        idempotencyKey: `sqoff-intra-${randomUUID()}`,
      },
    ]);

    await squareoffService.executeAutoSquareoff();

    expect(mockExecuteSell).toHaveBeenCalledTimes(1);
    const payload = mockExecuteSell.mock.calls[0][1];
    expect(payload.productType).toBe("INTRADAY");
    expect(payload.quantity).toBe(3);
    expect(payload.requestId).toBe(
      buildSystemRequestId({ type: "SQ", userId: user._id, symbol: "SQINTR" })
    );
  });

  it("aggregates multiple INTRADAY EXECUTED rows for same user+symbol into one squareoff", async () => {
    await Trade.create([
      {
        user: user._id,
        symbol: "SQINTR",
        type: "BUY",
        productType: "INTRADAY",
        status: "EXECUTED",
        quantity: 2,
        pricePaise: 400000,
        totalValuePaise: 800000,
        priceSource: "REAL",
        idempotencyKey: `sqoff-intra-a-${randomUUID()}`,
      },
      {
        user: user._id,
        symbol: "SQINTR",
        type: "BUY",
        productType: "INTRADAY",
        status: "EXECUTED",
        quantity: 3,
        pricePaise: 400000,
        totalValuePaise: 1_200_000,
        priceSource: "REAL",
        idempotencyKey: `sqoff-intra-b-${randomUUID()}`,
      },
    ]);

    await squareoffService.executeAutoSquareoff();

    expect(mockExecuteSell).toHaveBeenCalledTimes(1);
    expect(mockExecuteSell.mock.calls[0][1].quantity).toBe(5);
  });
});
