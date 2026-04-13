const mongoose = require("mongoose");

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

executionLockSchema.index({ requestId: 1 }, { unique: true, name: "requestId_1" });
executionLockSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120, name: "createdAt_1" });

const ExecutionLock = mongoose.model("ExecutionLock", executionLockSchema);
module.exports = ExecutionLock;
