jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
  })),
}));

jest.mock("../../lib/redisClient", () => null);
jest.mock("../../infra/redisHealth", () => ({
  isRedisAvailable: jest.fn(() => false),
}));
jest.mock("../../services/reflectionWorker.service", () => ({
  processTradeClosedEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../lib/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { processTradeClosedEvent } = require("../../services/reflectionWorker.service");
const { tradeQueue, registerInlineJobHandler } = require("../queue");

describe("queue fallback reliability", () => {
  beforeEach(() => {
    registerInlineJobHandler("USER_ANALYTICS_REFRESH", async () => {});
  });

  it("processes TRADE_CLOSED synchronously when redis unavailable", async () => {
    const result = await tradeQueue.add("TRADE_CLOSED", { tradeId: "t1", userId: "u1" });
    expect(result.status).toBe("PROCESSED_SYNCHRONOUSLY");
    expect(processTradeClosedEvent).toHaveBeenCalledWith({ tradeId: "t1", userId: "u1" });
  });

  it("routes future jobs through registered handlers", async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    registerInlineJobHandler("USER_ANALYTICS_REFRESH", handler);

    const result = await tradeQueue.add("USER_ANALYTICS_REFRESH", { userId: "u2" });
    expect(result.status).toBe("PROCESSED_SYNCHRONOUSLY");
    expect(handler).toHaveBeenCalledWith({ userId: "u2" });
  });

  it("throws for unsupported jobs with no handlers", async () => {
    await expect(tradeQueue.add("UNHANDLED_JOB", {})).rejects.toThrow("UNSUPPORTED_JOB_TYPE:UNHANDLED_JOB");
  });
});
