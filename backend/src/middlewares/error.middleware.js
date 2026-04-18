const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  const logData = {
    requestId: req.requestId,
    userId: req.user?._id,
    route: req.originalUrl,
    statusCode,
    message,
  };

  if (statusCode >= 500) {
    logger.error({
      ...logData,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined
    });
  } else {
    logger.warn(logData);
  }

  res.status(statusCode).json({
    success: false,
    requestId: req.requestId,
    message: statusCode === 500 && process.env.NODE_ENV === "production"
      ? "An internal server error occurred. Please contact institutional support."
      : message,
  });
};

module.exports = errorHandler;
