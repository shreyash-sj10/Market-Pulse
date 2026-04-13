const mongoose = require("mongoose");

const outboxSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ["PENDING", "SENT"],
    default: "PENDING"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Optimises cron polling
outboxSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model("Outbox", outboxSchema);
