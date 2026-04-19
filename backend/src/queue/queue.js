const { Queue } = require("bullmq");
const logger = require("../utils/logger");
const redisClient = require("../utils/redisClient");
const { isRedisAvailable } = require("../infra/redisHealth");

/**
 * PRODUCTION-GRADE QUEUE WRAPPER
 * 
 * Implements a dual-mode execution strategy:
 * 1. Redis Mode: Asynchronous jobs via BullMQ (Production)
 * 2. Fallback Mode: Direct synchronous execution (Dev/Infra Failure)
 */

const realQueue = redisClient ? new Queue("tradeQueue", { connection: redisClient }) : null;

const inlineHandlers = {
  TRADE_CLOSED: async (payload) => {
    const { processTradeClosedEvent } = require("../services/reflectionWorker.service");
    await processTradeClosedEvent(payload);
  },
  USER_ANALYTICS_RECALIBRATE: async (payload) => {
    const { recalibrateUserAnalyticsSnapshot } = require("../services/analyticsRecalibration.service");
    await recalibrateUserAnalyticsSnapshot(payload.userId);
  },
};

const registerInlineJobHandler = (jobName, handler) => {
  if (!jobName || typeof handler !== "function") {
    throw new Error("INVALID_INLINE_HANDLER_REGISTRATION");
  }
  inlineHandlers[jobName] = handler;
};

const processJobInline = async (jobName, payload) => {
  const handler = inlineHandlers[jobName];
  if (!handler) {
    throw new Error(`UNSUPPORTED_JOB_TYPE:${jobName}`);
  }
  await handler(payload);
};

const tradeQueue = {
  add: async (jobName, payload, options = {}) => {
    // MODE 1: ASYNC (Redis ON & Healthy)
    if (redisClient && isRedisAvailable()) {
      try {
        const queued = await realQueue.add(jobName, payload, options);
        return {
          status: "ENQUEUED",
          queueId: queued?.id || null,
        };
      } catch (err) {
        logger.error({
          action: "OUTBOX_QUEUE_ADD_FAILED",
          jobType: jobName,
          error: err.message,
          mode: "REDIS",
        });
      }
    }

    // MODE 2: FALLBACK (Redis OFF or failing add)
    try {
      await processJobInline(jobName, payload);
      logger.warn({
        action: "OUTBOX_SYNC_FALLBACK_EXECUTED",
        jobType: jobName,
        redisAvailable: isRedisAvailable(),
      });
      return { status: "PROCESSED_SYNCHRONOUSLY" };
    } catch (err) {
      logger.error({
        action: "OUTBOX_SYNC_FALLBACK_FAILED",
        jobType: jobName,
        error: err.message,
      });
      throw err;
    }
  },

  // Proxy remaining BullMQ Queue methods if needed
  on: (event, handler) => {
    if (realQueue) realQueue.on(event, handler);
  },

  emit: (event, data) => {
    if (realQueue) realQueue.emit(event, data);
  }
};

module.exports = { 
  tradeQueue, 
  connection: redisClient, 
  isRedisConnected: isRedisAvailable,
  registerInlineJobHandler,
};
