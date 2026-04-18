const Outbox = require("../models/outbox.model");
const { tradeQueue } = require("../queue/queue");
const logger = require("../utils/logger");

const POLL_MS = Number(process.env.OUTBOX_POLL_MS || 5000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 50);
const BASE_BACKOFF_MS = Number(process.env.OUTBOX_BACKOFF_BASE_MS || 2000);
const MAX_BACKOFF_MS = Number(process.env.OUTBOX_BACKOFF_MAX_MS || 5 * 60 * 1000);
const RETRY_ALERT_THRESHOLD = Number(process.env.OUTBOX_RETRY_ALERT_THRESHOLD || 5);
const PENDING_CRITICAL_THRESHOLD = Number(process.env.OUTBOX_PENDING_CRITICAL_THRESHOLD || 500);
const STUCK_PROCESSING_MS = Number(process.env.OUTBOX_STUCK_PROCESSING_MS || 60 * 1000);
let workerTimer = null;

const computeBackoffMs = (attempts) => {
  const exponent = Math.max(0, attempts - 1);
  const raw = BASE_BACKOFF_MS * (2 ** exponent);
  return Math.min(raw, MAX_BACKOFF_MS);
};

const getQueueDepth = async () => {
  const [pending, processing, failed] = await Promise.all([
    Outbox.countDocuments({ status: "PENDING" }),
    Outbox.countDocuments({ status: "PROCESSING" }),
    Outbox.countDocuments({ status: "FAILED" }),
  ]);

  return { pending, processing, failed };
};

const recoverStuckProcessingJobs = async () => {
  const cutoff = new Date(Date.now() - STUCK_PROCESSING_MS);
  const stuck = await Outbox.find({
    status: "PROCESSING",
    processingStartedAt: { $lte: cutoff },
  }).limit(BATCH_SIZE);

  for (const job of stuck) {
    const backoffMs = computeBackoffMs(Math.max(1, job.attempts));
    await Outbox.updateOne(
      { _id: job._id, status: "PROCESSING" },
      {
        $set: {
          status: "PENDING",
          nextAttemptAt: new Date(Date.now() + backoffMs),
          processingStartedAt: null,
          lastError: "RECOVERED_STUCK_PROCESSING",
        }
      }
    );

    logger.error({
      severity: "CRITICAL",
      action: "OUTBOX_STUCK_JOB_RECOVERED",
      jobId: String(job._id),
      jobType: job.type,
      status: "PENDING",
      attempts: job.attempts,
      latency: null,
      error: "RECOVERED_STUCK_PROCESSING",
    });
  }
};

const claimNextPendingJob = async () => {
  const now = new Date();
  return Outbox.findOneAndUpdate(
    {
      status: "PENDING",
      nextAttemptAt: { $lte: now },
    },
    {
      $set: {
        status: "PROCESSING",
        processingStartedAt: now,
      },
      $inc: { attempts: 1 },
    },
    {
      sort: { createdAt: 1, _id: 1 },
      new: true,
    }
  );
};

const markCompleted = async (job, latencyMs) => {
  await Outbox.updateOne(
    { _id: job._id, status: "PROCESSING" },
    {
      $set: {
        status: "COMPLETED",
        completedAt: new Date(),
        processingStartedAt: null,
        latencyMs,
        lastError: null,
      }
    }
  );
};

const markFailedOrRetry = async (job, error, latencyMs) => {
  const willRetry = job.attempts < job.maxAttempts;
  const nextAttemptAt = new Date(Date.now() + computeBackoffMs(job.attempts));

  await Outbox.updateOne(
    { _id: job._id, status: "PROCESSING" },
    {
      $set: willRetry
        ? {
            status: "PENDING",
            nextAttemptAt,
            processingStartedAt: null,
            latencyMs,
            lastError: error.message,
          }
        : {
            status: "FAILED",
            failedAt: new Date(),
            processingStartedAt: null,
            latencyMs,
            lastError: error.message,
          },
    }
  );

  const logPayload = {
    jobId: String(job._id),
    jobType: job.type,
    status: willRetry ? "PENDING" : "FAILED",
    attempts: job.attempts,
    latency: latencyMs,
    error: error.message,
    nextAttemptAt: willRetry ? nextAttemptAt.toISOString() : null,
  };

  if (!willRetry || job.attempts >= RETRY_ALERT_THRESHOLD) {
    logger.error({ severity: "CRITICAL", action: "OUTBOX_RETRY_THRESHOLD", ...logPayload });
  } else {
    logger.warn({ action: "OUTBOX_JOB_RETRY_SCHEDULED", ...logPayload });
  }
};

const processSingleJob = async (job) => {
  const startMs = Date.now();
  try {
    const queueResult = await tradeQueue.add(job.type, {
      ...job.payload,
      outboxJobId: String(job._id),
    }, {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 1,
    });
    const latencyMs = Date.now() - startMs;
    if (queueResult?.status === "PROCESSED_SYNCHRONOUSLY") {
      await markCompleted(job, latencyMs);
      logger.info({
        action: "OUTBOX_JOB_COMPLETED",
        jobId: String(job._id),
        jobType: job.type,
        status: "COMPLETED",
        attempts: job.attempts,
        latency: latencyMs,
        error: null,
      });
      return;
    }

    logger.info({
      action: "OUTBOX_JOB_ENQUEUED",
      jobId: String(job._id),
      jobType: job.type,
      status: "PROCESSING",
      attempts: job.attempts,
      latency: latencyMs,
      error: null,
    });
  } catch (error) {
    const latencyMs = Date.now() - startMs;
    await markFailedOrRetry(job, error, latencyMs);
  }
};

const processOutbox = async () => {
  try {
    await recoverStuckProcessingJobs();
    const depth = await getQueueDepth();
    if (depth.pending > PENDING_CRITICAL_THRESHOLD) {
      logger.error({
        severity: "CRITICAL",
        action: "OUTBOX_BACKPRESSURE_THRESHOLD",
        pendingJobs: depth.pending,
        threshold: PENDING_CRITICAL_THRESHOLD,
      });
    }

    let processed = 0;
    for (let i = 0; i < BATCH_SIZE; i += 1) {
      const job = await claimNextPendingJob();
      if (!job) break;
      processed += 1;
      await processSingleJob(job);
    }

    if (processed > 0 || depth.pending > 0 || depth.processing > 0) {
      logger.info({
        action: "OUTBOX_CYCLE_METRICS",
        queueDepth: depth.pending,
        processing: depth.processing,
        failed: depth.failed,
        processed,
      });
    }
  } catch (error) {
    logger.error({
      action: "OUTBOX_CYCLE_FAILED",
      error: error.message,
    });
  }
};

const startOutboxWorker = () => {
  if (workerTimer) return;
  workerTimer = setInterval(processOutbox, POLL_MS);
  processOutbox().catch(() => null);
  logger.info("[Outbox Worker] Polling started.");
};

module.exports = { startOutboxWorker, processOutbox };
