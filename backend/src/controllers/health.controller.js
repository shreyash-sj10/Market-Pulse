const mongoose = require("mongoose");
const { connection } = require("../queue/queue");
const logger = require("../lib/logger");

const healthCheck = (req, res) => {
  res.status(200).json({ status: "OK" });
};

const readinessCheck = async (req, res) => {
  const services = { db: "UP", redis: "UP", queue: "UP" };
  let isReady = true;
  let errorMsg = null;

  try {
    if (mongoose.connection.readyState !== 1) {
      services.db = "DOWN";
      isReady = false;
      throw new Error("DB_NOT_CONNECTED");
    }

    if (connection.status !== "ready") {
      services.redis = "DOWN";
      services.queue = "DOWN";
      isReady = false;
      throw new Error("REDIS_NOT_READY");
    }
  } catch(err) {
    logger.error(`[HealthCheck] Readiness failed: \${err.message}`);
    errorMsg = err.message;
  }

  if (isReady) {
    return res.status(200).json({
      status: "READY",
      services
    });
  } else {
    return res.status(503).json({
      status: "NOT_READY",
      services,
      error: errorMsg
    });
  }
};

module.exports = {
  healthCheck,
  readinessCheck,
};
