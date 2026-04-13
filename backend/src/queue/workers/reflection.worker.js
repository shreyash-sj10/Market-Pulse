const { Worker } = require("bullmq");
const { connection } = require("../queue");
const { processTradeClosedEvent } = require("../../services/reflectionWorker.service");
const logger = require("../../lib/logger");

const reflectionWorker = new Worker(
  "tradeQueue",
  async (job) => {
    logger.info(`[BullMQ] Starting job ${job.id} | name: ${job.name} | attempt: ${job.attemptsMade + 1}`);
    if (job.name === "TRADE_CLOSED") {
      await processTradeClosedEvent(job.data);
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
