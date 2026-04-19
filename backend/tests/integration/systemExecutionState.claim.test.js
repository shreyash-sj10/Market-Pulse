process.env.NODE_ENV = "test";

const mongoose = require("mongoose");
const SystemExecutionState = require("../../src/models/systemExecutionState.model");
const {
  claimExecution,
  completeExecution,
  abortExecution,
} = require("../../src/services/systemExecutionState.service");
const logger = require("../../src/utils/logger");

require("dotenv").config();
const mongoUri =
  process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/trading_platform_test";

describe("system execution state claim", () => {
  beforeAll(async () => {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await SystemExecutionState.deleteMany({ key: /^test:claim:/ });
    jest.restoreAllMocks();
  });

  it("only one leader claims a key; second gets null", async () => {
    const key = `test:claim:${Date.now()}`;
    const a = await claimExecution(key);
    const b = await claimExecution(key);
    expect(a?.status).toBe("RUNNING");
    expect(b).toBeNull();
    await completeExecution(key);
    const done = await SystemExecutionState.findOne({ key }).lean();
    expect(done.status).toBe("COMPLETED");
    expect(done.executedAt).toBeTruthy();
  });

  it("abortExecution marks FAILED and claim can reclaim for retry", async () => {
    const key = `test:claim:abort:${Date.now()}`;
    expect(await claimExecution(key)).toBeTruthy();
    await abortExecution(key, "boom");
    const failed = await SystemExecutionState.findOne({ key }).lean();
    expect(failed.status).toBe("FAILED");
    expect(failed.lastErrorMessage).toBe("boom");

    const again = await claimExecution(key);
    expect(again?.status).toBe("RUNNING");
    expect(again.lastErrorMessage == null).toBe(true);
  });

  it("treats legacy completed rows (executedAt, no status) as non-claimable", async () => {
    const key = `test:claim:legacy:${Date.now()}`;
    await SystemExecutionState.collection.insertOne({
      key,
      executedAt: new Date(),
    });
    expect(await claimExecution(key)).toBeNull();
  });

  it("removes corrupted legacy rows (no status, no executedAt) and then claims", async () => {
    const key = `test:claim:corrupt:${Date.now()}`;
    await SystemExecutionState.collection.insertOne({ key });
    const doc = await claimExecution(key);
    expect(doc?.status).toBe("RUNNING");
  });

  it("emits SQUAREOFF_STUCK when RUNNING is older than warn threshold but not stale", async () => {
    const prevWarn = process.env.SQUAREOFF_STUCK_WARN_MS;
    const prevStale = process.env.SQUAREOFF_CLAIM_STALE_MS;
    process.env.SQUAREOFF_STUCK_WARN_MS = String(60 * 1000);
    process.env.SQUAREOFF_CLAIM_STALE_MS = String(30 * 60 * 1000);

    const key = `test:claim:stuck:${Date.now()}`;
    await SystemExecutionState.collection.insertOne({
      key,
      status: "RUNNING",
      startedAt: new Date(Date.now() - 4 * 60 * 1000),
      executedAt: null,
    });

    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});
    expect(await claimExecution(key)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "SQUAREOFF_STUCK",
        key,
      })
    );

    if (prevWarn === undefined) delete process.env.SQUAREOFF_STUCK_WARN_MS;
    else process.env.SQUAREOFF_STUCK_WARN_MS = prevWarn;
    if (prevStale === undefined) delete process.env.SQUAREOFF_CLAIM_STALE_MS;
    else process.env.SQUAREOFF_CLAIM_STALE_MS = prevStale;
  });
});
