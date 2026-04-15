const mongoose = require("mongoose");

const outboxSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    index: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    // SENT kept for backward compatibility with existing rows.
    enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "SENT"],
    default: "PENDING",
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
  maxAttempts: {
    type: Number,
    default: Number(process.env.OUTBOX_MAX_ATTEMPTS || 8),
    min: 1,
  },
  nextAttemptAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  processingStartedAt: {
    type: Date,
    default: null,
    index: true,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  failedAt: {
    type: Date,
    default: null,
  },
  latencyMs: {
    type: Number,
    default: null,
  },
  lastError: {
    type: String,
    default: null,
  }
}, {
  timestamps: true,
});

// Optimises polling, retries and stuck-job recovery scans.
outboxSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
outboxSchema.index({ status: 1, processingStartedAt: 1 });

module.exports = mongoose.model("Outbox", outboxSchema);
