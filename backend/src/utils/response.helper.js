const { isRedisAvailable } = require("../infra/redisHealth");

/**
 * P1-B: Explicit API envelope — replaces global res.json monkey-patching in app.js.
 * Call sites use sendSuccess / sendError so contract fields are visible in code.
 */
function finalizeApiResponse(req, data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  const out = { ...data };
  out.degraded = !isRedisAvailable();
  const tid = req && (req.traceId || req.requestId);
  if (tid) {
    out.meta = { ...(out.meta || {}), traceId: tid };
  }
  if (
    req?.user &&
    typeof req.user.systemStateVersion === "number" &&
    (out.meta == null || out.meta.systemStateVersion == null)
  ) {
    out.meta = { ...(out.meta || {}), systemStateVersion: req.user.systemStateVersion };
  }
  if (out.timestamp === undefined) {
    out.timestamp = Date.now();
  }
  return out;
}

function sendSuccess(res, req, body, statusCode = 200) {
  return res.status(statusCode).json(finalizeApiResponse(req, body));
}

/**
 * Simple client errors (message + optional code / retryable).
 * For richer shapes (e.g. Zod issues), use sendSuccess with status 4xx and a full body.
 */
function sendError(res, req, error, statusCode = 500) {
  const message =
    typeof error === "string" ? error : error?.message || "Request error";
  const code =
    typeof error === "object" && error && error.code ? error.code : "REQUEST_ERROR";
  const traceId = req && (req.traceId || req.requestId);
  const retryable =
    typeof error === "object" && error && typeof error.retryable === "boolean"
      ? error.retryable
      : undefined;
  const body = {
    success: false,
    message,
    traceId,
    requestId: traceId,
    error: {
      code,
      message,
      traceId,
      ...(retryable !== undefined ? { retryable } : {}),
    },
    meta: { traceId },
  };
  return res.status(statusCode).json(finalizeApiResponse(req, body));
}

module.exports = {
  finalizeApiResponse,
  sendSuccess,
  sendError,
};
