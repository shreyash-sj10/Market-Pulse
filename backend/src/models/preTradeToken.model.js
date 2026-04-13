const mongoose = require("mongoose");

const preTradeTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    payloadHash: {
      type: String,
      required: true,
    },
    verdict: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

// Unique index: one token per use
preTradeTokenSchema.index({ token: 1 }, { unique: true, name: "token_1" });

// TTL: MongoDB auto-purges expired documents after 0 seconds past expiresAt
preTradeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expiresAt_ttl" });

const PreTradeToken = mongoose.model("PreTradeToken", preTradeTokenSchema);
module.exports = PreTradeToken;
