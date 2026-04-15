jest.mock("../../models/outbox.model", () => ({
  countDocuments: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock("../../queue/queue", () => ({
  tradeQueue: {
    add: jest.fn(),
  },
}));

jest.mock("../../lib/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const Outbox = require("../../models/outbox.model");
const { tradeQueue } = require("../../queue/queue");
const logger = require("../../lib/logger");
const { processOutbox } = require("../outbox.worker");

describe("outbox.worker reliability", () => {
  const mockNoStuckJobs = () => {
    Outbox.find.mockReturnValue({
      limit: jest.fn().mockResolvedValue([]),
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OUTBOX_PENDING_CRITICAL_THRESHOLD = "500";
    mockNoStuckJobs();
  });

  it("marks job completed on success", async () => {
    Outbox.countDocuments
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    Outbox.findOneAndUpdate
      .mockResolvedValueOnce({
        _id: "job-1",
        type: "TRADE_CLOSED",
        payload: { tradeId: "t1", userId: "u1" },
        attempts: 1,
        maxAttempts: 8,
      })
      .mockResolvedValueOnce(null);
    tradeQueue.add.mockResolvedValue({ status: "PROCESSED_SYNCHRONOUSLY" });
    Outbox.updateOne.mockResolvedValue({ acknowledged: true });

    await processOutbox();

    expect(tradeQueue.add).toHaveBeenCalledWith(
      "TRADE_CLOSED",
      expect.objectContaining({ tradeId: "t1", userId: "u1", outboxJobId: "job-1" }),
      expect.objectContaining({ attempts: 1 })
    );
    expect(Outbox.updateOne).toHaveBeenCalledWith(
      { _id: "job-1", status: "PROCESSING" },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
  });

  it("requeues failed jobs with retry metadata", async () => {
    Outbox.countDocuments
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    Outbox.findOneAndUpdate
      .mockResolvedValueOnce({
        _id: "job-2",
        type: "TRADE_CLOSED",
        payload: { tradeId: "t2", userId: "u2" },
        attempts: 2,
        maxAttempts: 8,
      })
      .mockResolvedValueOnce(null);
    tradeQueue.add.mockRejectedValue(new Error("redis down"));
    Outbox.updateOne.mockResolvedValue({ acknowledged: true });

    await processOutbox();

    expect(Outbox.updateOne).toHaveBeenCalledWith(
      { _id: "job-2", status: "PROCESSING" },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "PENDING",
          lastError: "redis down",
        }),
      })
    );
  });

  it("marks jobs FAILED after max attempts", async () => {
    Outbox.countDocuments
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    Outbox.findOneAndUpdate
      .mockResolvedValueOnce({
        _id: "job-3",
        type: "UNKNOWN_JOB",
        payload: {},
        attempts: 3,
        maxAttempts: 3,
      })
      .mockResolvedValueOnce(null);
    tradeQueue.add.mockRejectedValue(new Error("unsupported"));
    Outbox.updateOne.mockResolvedValue({ acknowledged: true });

    await processOutbox();

    expect(Outbox.updateOne).toHaveBeenCalledWith(
      { _id: "job-3", status: "PROCESSING" },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "FAILED",
          lastError: "unsupported",
        }),
      })
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it("recovers stuck PROCESSING jobs back to PENDING", async () => {
    Outbox.countDocuments
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    Outbox.find.mockReturnValue({
      limit: jest.fn().mockResolvedValue([
        { _id: "job-stuck", type: "TRADE_CLOSED", attempts: 2 },
      ]),
    });
    Outbox.findOneAndUpdate.mockResolvedValue(null);
    Outbox.updateOne.mockResolvedValue({ acknowledged: true });

    await processOutbox();

    expect(Outbox.updateOne).toHaveBeenCalledWith(
      { _id: "job-stuck", status: "PROCESSING" },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "PENDING",
          lastError: "RECOVERED_STUCK_PROCESSING",
        }),
      })
    );
  });
});
