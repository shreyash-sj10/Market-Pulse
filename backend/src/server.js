require("dotenv").config(); // Load environment variables
const app = require("./app"); // Import the Express app
const connectDB = require("./config/db"); // Import the database connection function
const stopLossMonitor = require("./services/stopLossMonitor.service");
const { startSquareOff } = require("./services/squareoff.service");
const { startOutboxWorker } = require("./workers/outbox.worker");
const { startSweeper } = require("./services/sweeper.service");
const { startExecutionExecutor } = require("./services/execution.executor");
const { isRedisAvailable } = require("./infra/redisHealth");

const PORT = process.env.PORT || 8080; // Define the port

/**
 * Start the server
 */
const startStopLossMonitor = async () => {
  await stopLossMonitor.start();
};

const startServer = async () => {
  try {
    await connectDB(); // Connect to MongoDB
    await startStopLossMonitor();
    startSquareOff();
    startOutboxWorker();

    // Existing worker startup preserved as reliability wiring.
    if (isRedisAvailable() && process.env.NODE_ENV !== "test") {
      require("./queue/workers/reflection.worker");
      startSweeper();
      startExecutionExecutor();
    } else if (process.env.NODE_ENV !== "test") {
      console.warn("Background Redis-dependent workers are in safe degraded mode (Redis unavailable).");
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1); // Exit with failure
  }
};

startServer();
