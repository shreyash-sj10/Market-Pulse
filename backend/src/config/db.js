const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error("\n" + "=".repeat(50));
    console.error("FATAL ERROR: MONGO_URI is not defined in .env file.");
    console.error("Please add MONGO_URI=mongodb://localhost:27017/trade_engine to your backend/.env");
    console.error("=".repeat(50) + "\n");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
    });
    logger.info("MongoDB connected successfully");
  } catch (error) {
    console.error("\n" + "=".repeat(50));
    console.error("DATABASE CONNECTION FAILED!");
    console.error("1. Ensure MongoDB is installed and running on your system.");
    console.error("2. Check if the connection string in .env is correct.");
    console.error("3. Error Details:", error.message);
    console.error("=".repeat(50) + "\n");
    
    // In a real production app we might exit, but for this project we'll 
    // log the error and wait for the user to fix it.
    process.exit(1);
  }
};

module.exports = connectDB;
