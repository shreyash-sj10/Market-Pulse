const { Queue } = require("bullmq");
const redisClient = require("../utils/redisClient");
const { isRedisAvailable } = require("../infra/redisHealth");
const logger = require("../utils/logger");
const runtimeState = require("../infra/runtimeState");
const { startSquareOff } = require("../services/squareoff.service");

/**
 * When Redis + BullMQ are healthy, use a weekday post-close cron (IST) instead of setInterval polling.
 * Falls back to legacy interval scheduler if Redis is unavailable (dev / degraded).
 */
async function startSquareOffQueueOrPoll() {
  const redisOk = Boolean(redisClient && isRedisAvailable());
  if (!redisOk) {
    startSquareOff();
    runtimeState.mark("squareoffMode", "interval");
    logger.info({
      service: "squareoff.schedule",
      step: "POLL_FALLBACK",
      status: "INFO",
      data: { reason: "Redis unavailable for BullMQ squareoff" },
    });
    return;
  }

  try {
    require("./workers/squareoff.worker");
    const q = new Queue("squareoffQueue", { connection: redisClient });
    await q.add(
      "AUTO_SQUAREOFF_TICK",
      {},
      {
        repeat: {
          pattern: "20 15 * * 1-5",
          tz: "Asia/Kolkata",
        },
        jobId: "squareoff-weekday-post-close-ist",
      }
    );
    logger.info({
      service: "squareoff.schedule",
      step: "BULL_REPEAT_REGISTERED",
      status: "SUCCESS",
      data: { pattern: "20 15 * * 1-5", tz: "Asia/Kolkata" },
    });
    runtimeState.mark("squareoffMode", "bullmq");
  } catch (err) {
    logger.error({
      service: "squareoff.schedule",
      step: "BULL_REGISTER_FAILED",
      status: "FAILURE",
      data: { message: err.message },
    });
    startSquareOff();
    runtimeState.mark("squareoffMode", "interval");
  }
}

module.exports = { startSquareOffQueueOrPoll };
