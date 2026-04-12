require("dotenv").config(); // Load environment variables
const app = require("./app"); // Import the Express app
const connectDB = require("./config/db"); // Import the database connection function
const stopLossMonitor = require("./services/stopLossMonitor.service");

const PORT = process.env.PORT || 8080; // Define the port

/**
 * Start the server
 */
const startServer = async () => {
  try {
    await connectDB(); // Connect to MongoDB
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1); // Exit with failure
  }
};

startServer();
