const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500; // Default to 500 Internal Server Error
  const message = err.message || "Internal Server Error";

  if (statusCode >= 400 && statusCode < 500) {
    logger.warn(`[${statusCode}] ${message} - ${req.originalUrl}`);
  } else {
    logger.error(`[${statusCode}] ${message} - ${req.originalUrl}\n${err.stack}`);
  }

  // Send JSON response with error details
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && process.env.NODE_ENV === "production" 
      ? "An internal server error occurred" 
      : message,
  });
};

module.exports = errorHandler;
