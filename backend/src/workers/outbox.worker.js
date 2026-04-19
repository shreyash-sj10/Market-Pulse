/**
 * P1-C — Process-local background loop (setInterval). Safe with **one** API instance.
 * Multiple Railway/web replicas each run this poller → duplicate claims / work (mitigated by
 * idempotent handlers where possible). Scale-out: dedicated worker dyno, Redis locks, or
 * BullMQ repeatable jobs. See `docs/BACKGROUND_WORKERS_SCALE.md`.
 */
const Outbox = require("../models/outbox.model");
const { tradeQueue } = require("../queue/queue");
const logger = require("../utils/logger");
const { runWithTrace } = require("../context/traceContext");
const { persistUserAnalyticsSnapshot } = require("../services/analytics.service");

const POLL_MS = Number(process.env.OUTBOX_POLL_MS || 5000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 50);
const BASE_BACKOFF_MS = Number(process.env.OUTBOX_BACKOFF_BASE_MS || 2000);
const MAX_BACKOFF_MS = Number(process.env.OUTBOX_BACKOFF_MAX_MS || 5 * 60 * 1000);
const RETRY_ALERT_THRESHOLD = Number(process.env.OUTBOX_RETRY_ALERT_THRESHOLD || 5);
const PENDING_CRITICAL_THRESHOLD = Number(process.env.OUTBOX_PENDING_CRITICAL_THRESHOLD || 500);
const STUCK_PROCESSING_MS = Number(process.env.OUTBOX_STUCK_PROCESSING_MS || 60 * 1000);
/** Max failures for `USER_ANALYTICS_SNAPSHOT` before marking outbox row FAILED (then operator / DLQ). */
const ANALYTICS_SNAPSHOT_MAX_RETRY = Math.max(1, Number(process.env.ANALYTICS_SNAPSHOT_MAX_RETRY || 3));
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

/**
 * Synchronous path: portfolio analytics (no BullMQ). Uses `retryCount` for bounded retries.
 */
const processUserAnalyticsSnapshotOutboxJob = async (job) => {
  const startMs = Date.now();
  const userId = job.payload?.userId;
  const traceId = job.payload?.traceId || `outbox-${String(job._id)}`;
  try {
    await runWithTrace({ traceId, userId: userId || null }, () => persistUserAnalyticsSnapshot(userId));
    await markCompleted(job, Date.now() - startMs);
    logger.info({
      action: "USER_ANALYTICS_SNAPSHOT_OUTBOX_COMPLETED",
      jobId: String(job._id),
      userId: String(userId),
      retryCount: job.retryCount ?? 0,
      latencyMs: Date.now() - startMs,
    });
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    const retryCount = (job.retryCount ?? 0) + 1;
    const hardFail = retryCount > ANALYTICS_SNAPSHOT_MAX_RETRY;
    await Outbox.updateOne(
      { _id: job._id, status: "PROCESSING" },
      {
        $set: hardFail
          ? {
              status: "FAILED",
              failedAt: new Date(),
              processingStartedAt: null,
              lastError: err.message,
              latencyMs,
              retryCount,
            }
          : {
              status: "PENDING",
              retryCount,
              nextAttemptAt: new Date(Date.now() + computeBackoffMs(Math.max(1, retryCount))),
              processingStartedAt: null,
              lastError: err.message,
              latencyMs,
            },
      }
    );
    if (hardFail) {
      logger.error({
        action: "USER_ANALYTICS_SNAPSHOT_OUTBOX_EXHAUSTED",
        jobId: String(job._id),
        userId: String(userId),
        retryCount,
        message: err.message,
      });
    } else {
      logger.warn({
        action: "USER_ANALYTICS_SNAPSHOT_OUTBOX_RETRY_SCHEDULED",
        jobId: String(job._id),
        userId: String(userId),
        retryCount,
        nextBackoffMs: computeBackoffMs(Math.max(1, retryCount)),
        message: err.message,
      });
    }
  }
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
    traceId: job.payload?.traceId,
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
  if (job.type === "USER_ANALYTICS_SNAPSHOT") {
    await processUserAnalyticsSnapshotOutboxJob(job);
    return;
  }

  const startMs = Date.now();
  const traceId = job.payload?.traceId || `outbox-${String(job._id)}`;
  try {
    const isHeavyAsyncJob =
      job.type === "TRADE_CLOSED" || job.type === "USER_ANALYTICS_RECALIBRATE";
    const queueResult = await runWithTrace(
      { traceId, userId: job.payload?.userId || null },
      () =>
        tradeQueue.add(
          job.type,
          {
            ...job.payload,
            outboxJobId: String(job._id),
          },
          {
            removeOnComplete: true,
            removeOnFail: false,
            attempts: isHeavyAsyncJob ? 5 : 1,
            backoff: isHeavyAsyncJob ? { type: "exponential", delay: 4000 } : undefined,
          }
        )
    );
    const latencyMs = Date.now() - startMs;

    // H-01 FIX: Always mark the outbox job COMPLETED after a successful queue.add().
    // Previously, only PROCESSED_SYNCHRONOUSLY results called markCompleted(); all
    // other successful enqueues left the job in PROCESSING state. After
    // STUCK_PROCESSING_MS the recovery loop re-set it to PENDING and re-enqueued
    // the job, creating an infinite duplication loop for every SELL trade.
    await markCompleted(job, latencyMs);

    const action =
      queueResult?.status === "PROCESSED_SYNCHRONOUSLY"
        ? "OUTBOX_JOB_COMPLETED"
        : "OUTBOX_JOB_ENQUEUED_AND_COMPLETED";

    logger.info({
      action,
      traceId,
      jobId: String(job._id),
      jobType: job.type,
      status: "COMPLETED",
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
  logger.info({
    service: "outbox.worker",
    step: "POLLING_STARTED",
    status: "SUCCESS",
    data: { pollMs: POLL_MS },
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  startOutboxWorker,
  processOutbox,
  __testables: { processUserAnalyticsSnapshotOutboxJob },
};
