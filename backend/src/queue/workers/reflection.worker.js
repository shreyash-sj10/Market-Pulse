const { Worker } = require("bullmq");
const { connection } = require("../queue");
const { processTradeClosedEvent } = require("../../services/reflectionWorker.service");
const { recalibrateUserAnalyticsSnapshot } = require("../../services/analyticsRecalibration.service");
const Outbox = require("../../models/outbox.model");
const Trade = require("../../models/trade.model");
const logger = require("../../utils/logger");
const { runWithTrace } = require("../../context/traceContext");

const reflectionWorker = new Worker(
  "tradeQueue",
  async (job) => {
    const traceId = job.data?.traceId || `bullmq-${job.id}`;
    await runWithTrace(
      { traceId, userId: job.data?.userId || null },
      async () => {
        logger.info({
          service: "reflection.worker",
          step: "JOB_START",
          status: "INFO",
          traceId,
          data: {
            jobId: job.id,
            name: job.name,
            attempt: job.attemptsMade + 1,
          },
          timestamp: new Date().toISOString(),
        });
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
          logger.info({
            service: "reflection.worker",
            step: "JOB_SUCCESS",
            status: "SUCCESS",
            traceId,
            data: { tradeId: job.data.tradeId },
            timestamp: new Date().toISOString(),
          });
        } else if (job.name === "USER_ANALYTICS_RECALIBRATE") {
          await recalibrateUserAnalyticsSnapshot(job.data.userId);
          logger.info({
            service: "reflection.worker",
            step: "JOB_SUCCESS",
            status: "SUCCESS",
            traceId,
            data: { userId: job.data.userId },
            timestamp: new Date().toISOString(),
          });
        }
      }
    );
  },
  {
    connection,
    concurrency: 5,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 4000 },
    },
  }
);

try {
  require("../../infra/runtimeState").mark("bullmqReflectionWorker", true);
} catch {
  /* optional */
}

reflectionWorker.on("completed", (job) => {
  logger.info({
    service: "reflection.worker",
    step: "BULLMQ_COMPLETED",
    status: "SUCCESS",
    traceId: job?.data?.traceId,
    data: { jobId: job?.id },
    timestamp: new Date().toISOString(),
  });
});

reflectionWorker.on("failed", async (job, err) => {
  logger.error({
    service: "reflection.worker",
    step: "BULLMQ_FAILED",
    status: "FAILURE",
    traceId: job?.data?.traceId,
    data: { jobId: job?.id, message: err?.message },
    timestamp: new Date().toISOString(),
  });
  if (!job || job.name !== "TRADE_CLOSED" || !job.data?.tradeId) return;
  const max = job.opts?.attempts || 5;
  if (job.attemptsMade < max) return;
  try {
    await Trade.findByIdAndUpdate(job.data.tradeId, { $set: { reflectionStatus: "FAILED" } });
    logger.error({ action: "REFLECTION_JOB_EXHAUSTED", tradeId: job.data.tradeId, attempts: job.attemptsMade });
  } catch (e) {
    logger.error({ action: "REFLECTION_FAILED_MARK_ERROR", message: e?.message });
  }
});

module.exports = reflectionWorker;
