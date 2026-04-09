const express = require("express");
const app = express();

app.use(express.json());
const cors = require("cors");

app.use(
  cors({
    origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, "http://localhost:5173", "http://localhost:5174", "http://localhost:5180"] : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5180"],
    credentials: true,
  }),
);
const morgan = require("morgan");
const logger = require("./utils/logger");

// Intercept Morgan logs and push them into Winston
app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));

// Routes
const healthRoutes = require("./routes/health.route");
const authRoutes = require("./routes/auth.route");

app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", require("./routes/user.route"));
app.use("/api/trades", require("./routes/trade.route"));
app.use("/api/portfolio", require("./routes/portfolio.route"));
app.use("/api/market", require("./routes/market.route"));
app.use("/api/analysis", require("./routes/analysis.route"));
app.use("/api/trace", require("./routes/trace.route"));

// Error middleware (ALWAYS LAST)
const errorHandler = require("./middlewares/error.middleware");
app.use(errorHandler);

module.exports = app;
