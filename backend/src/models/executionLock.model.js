const mongoose = require("mongoose");
const EXECUTION_LOCK_TTL_SECONDS = Number(process.env.EXECUTION_LOCK_TTL_SECONDS || 120);

const executionLockSchema = new mongoose.Schema(
  {
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
      enum: ["PENDING", "COMPLETED"],
      default: "PENDING",
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
  },
  {}
);

executionLockSchema.index({ userId: 1, requestId: 1 }, { unique: true, name: "idx_user_request_uniq" });
executionLockSchema.index({ createdAt: 1 }, { expireAfterSeconds: EXECUTION_LOCK_TTL_SECONDS, name: "createdAt_1" });

const ExecutionLock = mongoose.model("ExecutionLock", executionLockSchema);
module.exports = ExecutionLock;
