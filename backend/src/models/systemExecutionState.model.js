const mongoose = require("mongoose");

const systemExecutionStateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["RUNNING", "COMPLETED", "FAILED"],
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    executedAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    lastErrorMessage: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model("SystemExecutionState", systemExecutionStateSchema);
