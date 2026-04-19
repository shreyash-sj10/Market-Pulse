jest.mock("../../src/services/analytics.service", () => ({
  persistUserAnalyticsSnapshot: jest.fn(),
}));

jest.mock("../../src/context/traceContext", () => ({
  runWithTrace: jest.fn((_ctx, fn) => fn()),
}));

const Outbox = require("../../src/models/outbox.model");
const { persistUserAnalyticsSnapshot } = require("../../src/services/analytics.service");
const { __testables } = require("../../src/workers/outbox.worker");

const { processUserAnalyticsSnapshotOutboxJob } = __testables;

describe("processUserAnalyticsSnapshotOutboxJob", () => {
  beforeEach(() => {
    persistUserAnalyticsSnapshot.mockReset();
    jest.spyOn(Outbox, "updateOne").mockResolvedValue({ acknowledged: true });
  });

  afterEach(() => {
    Outbox.updateOne.mockRestore();
  });

  it("marks COMPLETED when persist succeeds", async () => {
    persistUserAnalyticsSnapshot.mockResolvedValue(undefined);
    const job = { _id: "507f1f77bcf86cd799439011", payload: { userId: "u1" }, retryCount: 0 };
    await processUserAnalyticsSnapshotOutboxJob(job);
    expect(persistUserAnalyticsSnapshot).toHaveBeenCalledWith("u1");
    expect(Outbox.updateOne).toHaveBeenCalledWith(
      { _id: job._id, status: "PROCESSING" },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "COMPLETED",
        }),
      })
    );
  });

  it("increments retryCount and returns to PENDING when under cap", async () => {
    persistUserAnalyticsSnapshot.mockRejectedValueOnce(new Error("transient"));
    const job = { _id: "507f1f77bcf86cd799439011", payload: { userId: "u1" }, retryCount: 0 };
    await processUserAnalyticsSnapshotOutboxJob(job);
    expect(Outbox.updateOne).toHaveBeenCalledWith(
      { _id: job._id, status: "PROCESSING" },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "PENDING",
          retryCount: 1,
        }),
      })
    );
  });

  it("marks FAILED when retryCount exceeds cap", async () => {
    persistUserAnalyticsSnapshot.mockRejectedValue(new Error("still broken"));
    const job = { _id: "507f1f77bcf86cd799439011", payload: { userId: "u1" }, retryCount: 3 };
    await processUserAnalyticsSnapshotOutboxJob(job);
    expect(Outbox.updateOne).toHaveBeenCalledWith(
      { _id: job._id, status: "PROCESSING" },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "FAILED",
          retryCount: 4,
        }),
      })
    );
  });
});
