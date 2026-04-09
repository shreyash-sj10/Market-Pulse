require("dotenv").config(); // Load environment variables
const app = require("./app"); // Import the Express app
const connectDB = require("./config/db"); // Import the database connection function
const stopLossMonitor = require("./services/stopLossMonitor.service");

const PORT = process.env.PORT || 8080; // Define the port

// Connect DB
connectDB().then(() => {
  // Start the background SL monitor after DB connection
  stopLossMonitor.start(30000); // 30s cycle
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
