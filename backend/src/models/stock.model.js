const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  name: String,
  sector: String,
  marketCap: Number,
  peRatio: Number,
  roe: Number,
  volume: Number,
  fundamentalData: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  lastFundamentalUpdate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model("Stock", stockSchema);
