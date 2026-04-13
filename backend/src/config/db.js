const mongoose = require("mongoose");
const logger = require("../utils/logger");
const Trace = require("../models/trace.model");
const ExecutionLock = require("../models/executionLock.model");
const Holding = require("../models/holding.model");

const TRACE_TTL_SECONDS = 7776000;
const EXECUTION_LOCK_TTL_SECONDS = 120;

const ensureTraceTtlIndex = async () => {
  const indexes = await Trace.collection.indexes();
  const ttlIndex = indexes.find((idx) => idx.key && idx.key.createdAt === 1);

  if (!ttlIndex) {
    await Trace.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: TRACE_TTL_SECONDS, name: "createdAt_1" });
    logger.info("Trace TTL index created (createdAt_1, 7776000s)");
    return;
  }

  if (ttlIndex.expireAfterSeconds !== TRACE_TTL_SECONDS) {
    await Trace.collection.dropIndex(ttlIndex.name);
    await Trace.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: TRACE_TTL_SECONDS, name: "createdAt_1" });
    logger.warn(`Trace TTL index corrected from ${ttlIndex.expireAfterSeconds}s to ${TRACE_TTL_SECONDS}s`);
    return;
  }

  logger.info("Trace TTL index verified (createdAt_1, 7776000s)");
};

const ensureExecutionLockIndexes = async () => {
  const indexes = await ExecutionLock.collection.indexes();
  const legacyIdempotencyIndex = indexes.find((idx) => idx.key && idx.key.idempotencyKey === 1);
  const requestIdIndex = indexes.find((idx) => idx.key && idx.key.requestId === 1);
  const ttlIndex = indexes.find((idx) => idx.key && idx.key.createdAt === 1);

  if (legacyIdempotencyIndex?.name) {
    await ExecutionLock.collection.dropIndex(legacyIdempotencyIndex.name);
    logger.warn(`ExecutionLock legacy index dropped (${legacyIdempotencyIndex.name})`);
  }

  if (!requestIdIndex || requestIdIndex.unique !== true) {
    if (requestIdIndex?.name) {
      await ExecutionLock.collection.dropIndex(requestIdIndex.name);
    }
    await ExecutionLock.collection.createIndex({ requestId: 1 }, { unique: true, name: "requestId_1" });
    logger.info("ExecutionLock unique index created (requestId_1)");
  } else {
    logger.info("ExecutionLock unique index verified (requestId_1)");
  }

  if (!ttlIndex) {
    await ExecutionLock.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: EXECUTION_LOCK_TTL_SECONDS, name: "createdAt_1" });
    logger.info("ExecutionLock TTL index created (createdAt_1, 120s)");
  } else if (ttlIndex.expireAfterSeconds !== EXECUTION_LOCK_TTL_SECONDS) {
    await ExecutionLock.collection.dropIndex(ttlIndex.name);
    await ExecutionLock.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: EXECUTION_LOCK_TTL_SECONDS, name: "createdAt_1" });
    logger.warn(`ExecutionLock TTL index corrected from ${ttlIndex.expireAfterSeconds}s to ${EXECUTION_LOCK_TTL_SECONDS}s`);
  } else {
    logger.info("ExecutionLock TTL index verified (createdAt_1, 120s)");
  }
};

const ensureHoldingsIndexes = async () => {
  const indexes = await Holding.collection.indexes();
  const uniqueIndex = indexes.find((idx) => idx.key && idx.key.userId === 1 && idx.key.symbol === 1);

  if (!uniqueIndex || uniqueIndex.unique !== true) {
    if (uniqueIndex?.name) {
      await Holding.collection.dropIndex(uniqueIndex.name);
    }
    await Holding.collection.createIndex({ userId: 1, symbol: 1 }, { unique: true, name: "userId_1_symbol_1" });
    logger.info("Holding unique index created (userId_1_symbol_1)");
  } else {
    logger.info("Holding unique index verified (userId_1_symbol_1)");
  }
};

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
    await ensureTraceTtlIndex();
    await ensureExecutionLockIndexes();
    await ensureHoldingsIndexes();
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
