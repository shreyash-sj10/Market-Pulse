const { randomUUID } = require("crypto");

const requestTrace = (req, res, next) => {
  const requestId = req.headers["x-request-id"] || randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
};

module.exports = requestTrace;
