const mongoose = require("mongoose");

const holdingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    tradeType: {
      type: String,
      enum: ["DELIVERY", "INTRADAY"],
      required: true,
      uppercase: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    avgPricePaise: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "avgPricePaise must be an integer",
      },
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

holdingSchema.index(
  { userId: 1, symbol: 1, tradeType: 1 },
  { unique: true, name: "idx_user_symbol_type_uniq" }
);

const Holding = mongoose.model("Holding", holdingSchema);
module.exports = Holding;
