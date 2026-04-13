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

holdingSchema.index({ userId: 1, symbol: 1 }, { unique: true, name: "userId_1_symbol_1" });

const Holding = mongoose.model("Holding", holdingSchema);
module.exports = Holding;
