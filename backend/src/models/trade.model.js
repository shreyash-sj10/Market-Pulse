const mongoose = require("mongoose");

const tradeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["BUY", "SELL"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    pricePaise: {
      type: Number,
      required: true,
      min: 0,
    },
    totalValuePaise: {
      type: Number,
      required: true,
    },
    stopLoss: {
      type: Number,
      default: null,
    },
    targetPrice: {
      type: Number,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
    },
    userThinking: {
      type: String,
      trim: true,
    },

    // 🔥 Mistake analysis snapshot
    analysis: {
      riskScore: {
        type: Number,
        min: 0,
        max: 100,
      },
      mistakeTags: {
        type: [String],
        default: [],
      },
      explanation: {
        type: String,
      },
      humanBehavior: {
        type: String,
      }
    },
    pnl: {
      type: Number,
      default: null, // Only for SELL trades
    },
    pnlPercentage: {
      type: Number,
      default: null, // Only for SELL trades
    },
    rawIntent: {
      type: String,
      trim: true
    },
    parsedIntent: {
      strategy: { type: String, default: 'General' },
      confidence: { type: Number, default: 50 },
      keywords: [String]
    },
    marketContextAtEntry: {
      rsi: Number,
      trend: String,
      volatility: Number
    },
    missedOpportunity: {
      maxPotentialProfit: { type: Number, default: 0 },
      maxProfitPct: { type: Number, default: 0 },
      peakPrice: { type: Number, default: 0 }
    },
    learningOutcome: {
      verdict: { type: String, enum: ["GOOD", "LUCK", "POOR", "NEUTRAL", "DISCIPLINED PROFIT", "LUCKY PROFIT", "DISCIPLINED LOSS", "POOR PROCESS"] },
      type: String, // Mistake Type
      context: String,
      insight: String,
      improvementSuggestion: String
    },
    finalTradeCall: {
      finalCall: String,
      confidence: Number,
      reasoning: String,
      suggestedAction: String
    },
    intelligenceTimeline: { 
      preTrade: {
        riskLevel: String,
        flags: [String],
        reasoning: [String]
      },
      postTrade: {
        outcome: String,
        alignment: String,
        observations: [String],
        behavioralFlags: [String],
        insightSummary: String
      },
      learningTags: [String],
      trace: [String]
    },
    rrRatio: {
      type: Number,
      default: null,
    },
    manualTags: {
      type: [String],
      default: [],
    }
  },
  {
    timestamps: true,
  }
);

tradeSchema.index({ user: 1, symbol: 1, createdAt: -1 }, { background: true });

const Trade = mongoose.model("Trade", tradeSchema);
module.exports = Trade;
