jest.mock("../../src/services/analytics.service", () => ({
  persistUserAnalyticsSnapshot: jest.fn().mockResolvedValue(undefined),
}));

const { persistUserAnalyticsSnapshot } = require("../../src/services/analytics.service");
const { handleTradeClosed } = require("../../src/workers/analytics.worker");

describe("analytics.worker handleTradeClosed", () => {
  beforeEach(() => {
    persistUserAnalyticsSnapshot.mockClear();
  });

  it("calls persistUserAnalyticsSnapshot with userId from payload", async () => {
    await handleTradeClosed({ payload: { userId: "user-1", tradeId: "t-1" } });
    expect(persistUserAnalyticsSnapshot).toHaveBeenCalledWith("user-1");
  });

  it("no-ops when userId missing", async () => {
    await handleTradeClosed({ payload: { tradeId: "t-1" } });
    expect(persistUserAnalyticsSnapshot).not.toHaveBeenCalled();
  });

  it("swallows errors from persist (does not throw)", async () => {
    persistUserAnalyticsSnapshot.mockRejectedValueOnce(new Error("boom"));
    await expect(handleTradeClosed({ payload: { userId: "u1" } })).resolves.toBeUndefined();
  });
});
