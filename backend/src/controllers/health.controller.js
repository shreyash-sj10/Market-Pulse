const mongoose = require("mongoose");
const { connection } = require("../queue/queue");
const logger = require("../utils/logger");
const { isRedisAvailable } = require("../infra/redisHealth");
const runtimeState = require("../infra/runtimeState");
const { sendSuccess } = require("../utils/response.helper");

const healthCheck = (req, res) => {
  sendSuccess(res, req, { status: "OK" });
};

const workerUp = (v) => (v ? "UP" : "DOWN");

const buildHealthPayload = async () => {
  const rt = runtimeState.snapshot();
  const redisUp = isRedisAvailable();
  const dbUp = mongoose.connection.readyState === 1;

  const services = {
    mongodb: dbUp ? "UP" : "DOWN",
    redis: redisUp ? "UP" : "DOWN",
    bullmqTradeQueue: connection && redisUp ? "UP" : "DOWN",
    stopLossMonitor: workerUp(rt.stopLossMonitor),
    outboxWorker: workerUp(rt.outboxWorker),
    sweeper: workerUp(rt.sweeper),
    executionExecutor: workerUp(rt.executionExecutor),
    squareoff:
      rt.squareoffMode === "bullmq"
        ? "UP_BULLMQ"
        : rt.squareoffMode === "interval"
          ? "UP_INTERVAL"
          : "DOWN",
    bullmqReflectionWorker: workerUp(rt.bullmqReflectionWorker),
    bullmqSquareoffWorker: workerUp(rt.bullmqSquareoffWorker),
  };

  const isTest = process.env.NODE_ENV === "test";
  const workersReady =
    isTest ||
    (rt.stopLossMonitor &&
      rt.outboxWorker &&
      rt.sweeper &&
      rt.executionExecutor &&
      (rt.squareoffMode === "bullmq" || rt.squareoffMode === "interval"));

  const allCoreUp = dbUp && workersReady;

  const status =
    !dbUp ? "NOT_READY" : allCoreUp && redisUp ? "READY" : allCoreUp ? "DEGRADED" : "NOT_READY";

  return { status, services };
};

const readinessCheck = async (req, res) => {
  try {
    const payload = await buildHealthPayload();
    if (payload.status === "NOT_READY") {
      return sendSuccess(res, req, { ...payload, error: "NOT_READY" }, 503);
    }
    if (payload.status === "DEGRADED") {
      return sendSuccess(res, req, {
        ...payload,
        message: "Redis optional subsystems limited — core execution paths active",
      });
    }
    return sendSuccess(res, req, payload);
  } catch (err) {
    logger.error({
      service: "health.controller",
      step: "READINESS",
      status: "FAILURE",
      data: { message: err.message },
      timestamp: new Date().toISOString(),
    });
    return sendSuccess(res, req, { status: "ERROR", error: err.message }, 503);
  }
};

/** Richer probe for load balancers — same payload shape as readiness. */
const detailedHealth = async (req, res) => {
  try {
    const payload = await buildHealthPayload();
    const code =
      payload.status === "NOT_READY" || payload.services.mongodb === "DOWN" ? 503 : 200;
    return sendSuccess(res, req, { ...payload, timestamp: new Date().toISOString() }, code);
  } catch (err) {
    return sendSuccess(res, req, { status: "ERROR", error: err.message }, 503);
  }
};

module.exports = {
  healthCheck,
  readinessCheck,
  detailedHealth,
  buildHealthPayload,
};
