const mongoose = require("mongoose");
const { connection } = require("../queue/queue");
const logger = require("../utils/logger");

const healthCheck = (req, res) => {
  res.status(200).json({ status: "OK" });
};

const { isRedisAvailable } = require("../infra/redisHealth");

const readinessCheck = async (req, res) => {
  const services = { db: "UP", redis: isRedisAvailable() ? "UP" : "DOWN" };
  
  try {
    if (mongoose.connection.readyState !== 1) {
      services.db = "DOWN";
      return res.status(503).json({ status: "NOT_READY", services, error: "DB_DOWN" });
    }

    if (!isRedisAvailable()) {
      return res.status(200).json({ 
        status: "DEGRADED", 
        services, 
        message: "Background processing limited" 
      });
    }

    return res.status(200).json({ status: "READY", services });
  } catch(err) {
    logger.error(`[HealthCheck] Readiness failed: ${err.message}`);
    return res.status(503).json({ status: "ERROR", error: err.message });
  }
};

module.exports = {
  healthCheck,
  readinessCheck,
};
