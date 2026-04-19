const mongoose = require("mongoose");
const EXECUTION_LOCK_TTL_SECONDS = Number(process.env.EXECUTION_LOCK_TTL_SECONDS || 604800);

const executionLockSchema = new mongoose.Schema(
  {
    /** Client idempotency key — globally unique (DB-enforced). Sparse for legacy rows. */
    idempotencyKey: {
      type: String,
      required: false,
      trim: true,
      sparse: true,
    },
    requestId: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "COMPLETED", "PENDING"],
      default: "IN_PROGRESS",
    },
    /** Canonical execution body hash (idempotency + PAYLOAD_MISMATCH guard). */
    requestPayloadHash: {
      type: String,
      default: null,
    },
    pendingTradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trade",
      default: null,
    },
    responseHash: {
      type: String,
      default: null,
    },
    responseData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {}
);

executionLockSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true, name: "idx_idempotencyKey_uniq" });
// H-04 FIX: Make the compound lookup index unique so that two concurrent requests
// with the same userId+requestId cannot both succeed the upsert and create two
// separate lock documents. Without this, the 11000 duplicate-key guard in
// runAtomicTradeExecution only fires for the idempotencyKey sparse index,
// leaving a window where concurrent requests bypass idempotency.
executionLockSchema.index({ userId: 1, requestId: 1 }, { unique: true, name: "idx_user_request_uniq" });
executionLockSchema.index({ createdAt: 1 }, { expireAfterSeconds: EXECUTION_LOCK_TTL_SECONDS, name: "createdAt_ttl" });

const ExecutionLock = mongoose.model("ExecutionLock", executionLockSchema);
module.exports = ExecutionLock;
