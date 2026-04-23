const { Worker } = require("bullmq");
const redisClient = require("../../utils/redisClient");
const squareoffService = require("../../services/squareoff.service");
const logger = require("../../utils/logger");

if (!redisClient || !redisClient.supportsBullMQ) {
  module.exports = null;
} else {
  try {
    require("../../infra/runtimeState").mark("bullmqSquareoffWorker", true);
  } catch {
    /* optional */
  }
  const worker = new Worker(
    "squareoffQueue",
    async (job) => {
      if (job.name === "AUTO_SQUAREOFF_TICK") {
        await squareoffService.runIfEligible();
      }
    },
    {
      connection: redisClient,
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    logger.error({
      service: "squareoff.worker",
      step: "JOB_FAILED",
      data: { jobId: job?.id, message: err?.message },
    });
  });

  module.exports = worker;
}
