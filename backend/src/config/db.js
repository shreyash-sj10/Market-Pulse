const mongoose = require("mongoose");
const logger = require("../utils/logger");
const Trace = require("../models/trace.model");
const ExecutionLock = require("../models/executionLock.model");
const Holding = require("../models/holding.model");
const Trade = require("../models/trade.model");

const TRACE_TTL_SECONDS = 7776000;
/** Keep in sync with `models/executionLock.model.js` default. */
const EXECUTION_LOCK_TTL_SECONDS = Number(process.env.EXECUTION_LOCK_TTL_SECONDS || 604800);

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
  const legacyIdempotencyIndex = indexes.find(
    (idx) =>
      idx.key &&
      idx.key.idempotencyKey === 1 &&
      Object.keys(idx.key).length === 1
  );
  const requestIdOnlyIndex = indexes.find(
    (idx) =>
      idx.key &&
      idx.key.requestId === 1 &&
      Object.keys(idx.key).length === 1
  );
  const userRequestIndex = indexes.find(
    (idx) =>
      idx.key &&
      idx.key.userId === 1 &&
      idx.key.requestId === 1 &&
      Object.keys(idx.key).length === 2
  );
  const ttlIndex = indexes.find((idx) => idx.key && idx.key.createdAt === 1);

  if (legacyIdempotencyIndex?.name) {
    await ExecutionLock.collection.dropIndex(legacyIdempotencyIndex.name);
    logger.warn(`ExecutionLock legacy index dropped (${legacyIdempotencyIndex.name})`);
  }

  if (requestIdOnlyIndex?.name) {
    await ExecutionLock.collection.dropIndex(requestIdOnlyIndex.name);
    logger.warn(`ExecutionLock global requestId index dropped (${requestIdOnlyIndex.name})`);
  }

  if (!userRequestIndex || userRequestIndex.unique !== true) {
    if (userRequestIndex?.name) {
      await ExecutionLock.collection.dropIndex(userRequestIndex.name);
    }
    await ExecutionLock.collection.createIndex(
      { userId: 1, requestId: 1 },
      { unique: true, name: "idx_user_request_uniq" }
    );
    logger.info("ExecutionLock unique index created (idx_user_request_uniq)");
  } else {
    logger.info("ExecutionLock unique index verified (idx_user_request_uniq)");
  }

  if (!ttlIndex) {
    await ExecutionLock.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: EXECUTION_LOCK_TTL_SECONDS, name: "createdAt_1" });
    logger.info(`ExecutionLock TTL index created (createdAt_1, ${EXECUTION_LOCK_TTL_SECONDS}s)`);
  } else if (ttlIndex.expireAfterSeconds !== EXECUTION_LOCK_TTL_SECONDS) {
    await ExecutionLock.collection.dropIndex(ttlIndex.name);
    await ExecutionLock.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: EXECUTION_LOCK_TTL_SECONDS, name: "createdAt_1" });
    logger.warn(`ExecutionLock TTL index corrected from ${ttlIndex.expireAfterSeconds}s to ${EXECUTION_LOCK_TTL_SECONDS}s`);
  } else {
    logger.info(`ExecutionLock TTL index verified (createdAt_1, ${EXECUTION_LOCK_TTL_SECONDS}s)`);
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

const ensureTradeIdempotencyIndexes = async () => {
  const indexes = await Trade.collection.indexes();
  const legacyGlobalIdempotency = indexes.find(
    (idx) =>
      idx.key &&
      idx.key.idempotencyKey === 1 &&
      Object.keys(idx.key).length === 1
  );
  const userScopedIdempotency = indexes.find(
    (idx) =>
      idx.key &&
      idx.key.user === 1 &&
      idx.key.idempotencyKey === 1 &&
      Object.keys(idx.key).length === 2
  );

  if (legacyGlobalIdempotency?.name) {
    await Trade.collection.dropIndex(legacyGlobalIdempotency.name);
    logger.warn(`Trade legacy global idempotency index dropped (${legacyGlobalIdempotency.name})`);
  }

  if (!userScopedIdempotency || userScopedIdempotency.unique !== true) {
    if (userScopedIdempotency?.name) {
      await Trade.collection.dropIndex(userScopedIdempotency.name);
    }
    await Trade.collection.createIndex(
      { user: 1, idempotencyKey: 1 },
      { unique: true, sparse: true, name: "idx_trade_user_idempotency_uniq" }
    );
    logger.info("Trade idempotency scoped unique index created (idx_trade_user_idempotency_uniq)");
  } else {
    logger.info("Trade idempotency scoped unique index verified (idx_trade_user_idempotency_uniq)");
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    logger.error("FATAL: MONGO_URI is not defined. Set it in backend/.env (see .env.example).");
    process.exit(1);
  }

  const maxAttempts = Math.max(1, Number(process.env.MONGO_CONNECT_RETRIES || 3));
  const poolSize = Math.max(1, Number(process.env.MONGO_MAX_POOL_SIZE || 10));
  const lastError = { message: "" };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_MS || 10000),
        maxPoolSize: poolSize,
        retryWrites: true,
      });
      await ensureTraceTtlIndex();
      await ensureExecutionLockIndexes();
      await ensureHoldingsIndexes();
      await ensureTradeIdempotencyIndexes();
      logger.info({ attempt }, "MongoDB connected successfully");
      return;
    } catch (error) {
      lastError.message = error?.message || String(error);
      logger.error(
        { attempt, maxAttempts, err: lastError.message },
        "MongoDB connection attempt failed"
      );
      if (attempt >= maxAttempts) {
        logger.error(
          "MongoDB unavailable after retries. Check URI, replica set (for transactions), and network."
        );
        process.exit(1);
      }
      await sleep(1000 * attempt);
    }
  }
};

module.exports = connectDB;
