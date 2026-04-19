const logger = require("./logger");
const { getTraceId, getUserId } = require("../context/traceContext");
const traceEventBuffer = require("./traceEventBuffer");

/**
 * Structured flow log (additive observability). Never log secrets/tokens.
 */
const flowLog = ({ service, step, status = "INFO", data = {} }) => {
  const traceId = getTraceId();
  const userId = getUserId();
  const payload = {
    traceId,
    userId,
    service,
    step,
    status,
    data,
    timestamp: new Date().toISOString(),
  };
  traceEventBuffer.push({ traceId, service, step, status });
  if (status === "FAILURE" || status === "ERROR") {
    logger.error(payload);
  } else if (status === "WARN") {
    logger.warn(payload);
  } else {
    logger.info(payload);
  }
};

module.exports = { flowLog };
