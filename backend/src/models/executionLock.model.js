const mongoose = require("mongoose");

const executionLockSchema = new mongoose.Schema(
  {
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
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
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically remove old locks after 24 hours
executionLockSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const ExecutionLock = mongoose.model("ExecutionLock", executionLockSchema);
module.exports = ExecutionLock;
