const { randomUUID } = require("crypto");
const { runWithTrace } = require("../context/traceContext");

/**
 * End-to-end trace id: prefer client X-Trace-Id, then X-Request-Id, then new UUID.
 * Binds AsyncLocalStorage for downstream service + worker correlation when propagated.
 */
const requestTrace = (req, res, next) => {
  const traceId =
    (typeof req.headers["x-trace-id"] === "string" && req.headers["x-trace-id"].trim()) ||
    (typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"].trim()) ||
    randomUUID();

  req.requestId = traceId;
  req.traceId = traceId;
  res.setHeader("X-Trace-Id", traceId);
  res.setHeader("X-Request-Id", traceId);

  runWithTrace({ traceId, userId: null }, () => next());
};

module.exports = requestTrace;
