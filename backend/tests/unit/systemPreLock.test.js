jest.mock("../../src/utils/redisClient", () => ({
  status: "ready",
  set: jest.fn(),
}));

const redisClient = require("../../src/utils/redisClient");
const { acquirePreLock } = require("../../src/utils/systemPreLock");

describe("acquirePreLock", () => {
  beforeEach(() => {
    redisClient.set.mockReset();
  });

  it("returns true when first SET NX wins and false on duplicate key", async () => {
    redisClient.set.mockResolvedValueOnce("OK").mockResolvedValueOnce(null);
    await expect(acquirePreLock("lock:idem:sl:1")).resolves.toBe(true);
    await expect(acquirePreLock("lock:idem:sl:1")).resolves.toBe(false);
    expect(redisClient.set).toHaveBeenCalledWith("lock:idem:sl:1", "1", "NX", "EX", 60);
  });

  it("returns true when set throws (degrade open)", async () => {
    redisClient.set.mockRejectedValueOnce(new Error("ECONNRESET"));
    await expect(acquirePreLock("lock:err:1")).resolves.toBe(true);
  });
});
