const express = require("express");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const app = express();
const requestTrace = require("./middlewares/requestTrace");
const { onRequest: metricsOnRequest } = require("./middlewares/requestMetrics");
const { readinessCheck, detailedHealth } = require("./controllers/health.controller");
const { snapshot: metricsSnapshot } = require("./middlewares/requestMetrics");

app.use(requestTrace);
app.use(metricsOnRequest);
app.use(helmet());
app.use(express.json());
app.use(mongoSanitize());

/** Root probes (load balancers / k8s) — no /api prefix */
app.get("/health", detailedHealth);
app.get("/ready", readinessCheck);
app.get("/metrics", (req, res) => {
  res.status(200).json({
    status: "ok",
    ...metricsSnapshot(),
    meta: { traceId: req.traceId || req.requestId },
  });
});

const cors = require("cors");
app.set("etag", false);

// In production (FRONTEND_URL set) allow only the deployed origin.
// In development (no FRONTEND_URL) allow the common Vite dev ports.
const corsOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5180"];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    exposedHeaders: ["X-Trace-Id", "X-Request-Id"],
  }),
);
const morgan = require("morgan");
const logger = require("./utils/logger");

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  next();
});

// Intercept Morgan logs and push them into Winston
app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));

// Routes
const healthRoutes = require("./routes/health.route");
const authRoutes = require("./routes/auth.route");

app.use("/api", healthRoutes);
app.use("/api/observability", require("./routes/observability.route"));
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
