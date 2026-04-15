const { Worker } = require("bullmq");
const { connection } = require("../queue");
const { processTradeClosedEvent } = require("../../services/reflectionWorker.service");
const Outbox = require("../../models/outbox.model");
const logger = require("../../lib/logger");

const reflectionWorker = new Worker(
  "tradeQueue",
  async (job) => {
    logger.info(`[BullMQ] Starting job ${job.id} | name: ${job.name} | attempt: ${job.attemptsMade + 1}`);
    if (job.name === "TRADE_CLOSED") {
      await processTradeClosedEvent(job.data);
      if (job.data?.outboxJobId) {
        await Outbox.updateOne(
          { _id: job.data.outboxJobId, status: "PROCESSING" },
          {
            $set: {
              status: "COMPLETED",
              completedAt: new Date(),
              processingStartedAt: null,
              lastError: null,
            },
          }
        );
      }
      logger.info("Reflection job processed", { tradeId: job.data.tradeId });
    }
  },
  { 
    connection,
    concurrency: 5
  }
);

reflectionWorker.on("completed", (job) => {
  logger.info(`[BullMQ] Success: Job ${job.id} completed flawlessly`);
});

reflectionWorker.on("failed", (job, err) => {
  logger.error(`[BullMQ] Failure: Job ${job.id} failed with error ${err.message}`);
});

module.exports = reflectionWorker;
