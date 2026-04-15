const express = require("express");
const app = express();
const requestTrace = require("./middlewares/requestTrace");

app.use(requestTrace);
app.use(express.json());

const cors = require("cors");
app.set("etag", false);

app.use(
  cors({
    origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, "http://localhost:5173", "http://localhost:5174", "http://localhost:5180"] : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5180"],
    credentials: true,
  }),
);
const morgan = require("morgan");
const logger = require("./utils/logger");

const { isRedisAvailable } = require("./infra/redisHealth");

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");

  // Part 7: Global system mode visibility
  const originalJson = res.json;
  res.json = function(data) {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      data.degraded = !isRedisAvailable();
    }
    return originalJson.call(this, data);
  };

  next();
});

// Intercept Morgan logs and push them into Winston
app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));

// Routes
const healthRoutes = require("./routes/health.route");
const authRoutes = require("./routes/auth.route");

app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", require("./routes/user.route"));
app.use("/api/trades", require("./routes/trade.route"));
app.use("/api/journal", require("./routes/journal.route"));
app.use("/api/portfolio", require("./routes/portfolio.route"));
app.use("/api/market", require("./routes/market.route"));
app.use("/api/analysis", require("./routes/analysis.route"));
app.use("/api/trace", require("./routes/trace.route"));
app.use("/api/intelligence", require("./routes/intelligence.route"));
app.use("/api/metrics", require("./routes/metrics.route"));


// Error middleware (ALWAYS LAST)
const errorHandler = require("./middlewares/error.middleware");
app.use(errorHandler);

module.exports = app;
