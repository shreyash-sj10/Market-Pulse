const logger = require("../utils/logger");
const { inferRetryable, deriveErrorCode } = require("../utils/errorResponse");
const { finalizeApiResponse } = require("../utils/response.helper");

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const traceId = req.traceId || req.requestId;
  const code = deriveErrorCode(err, statusCode);
  const retryable = typeof err.retryable === "boolean" ? err.retryable : inferRetryable(statusCode, message);

  const logData = {
    traceId,
    requestId: traceId,
    userId: req.user?._id,
    route: req.originalUrl,
    statusCode,
    message,
    code,
  };

  if (statusCode >= 500) {
    logger.error({
      ...logData,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    });
  } else {
    logger.warn(logData);
  }

  const publicMessage =
    statusCode === 500 && process.env.NODE_ENV === "production"
      ? "An internal server error occurred. Please contact institutional support."
      : message;

  res.status(statusCode).json(
    finalizeApiResponse(req, {
      success: false,
      requestId: traceId,
      traceId,
      message: publicMessage,
      error: {
        code,
        message: publicMessage,
        traceId,
        retryable,
      },
      meta: { traceId },
    })
  );
};

module.exports = errorHandler;
