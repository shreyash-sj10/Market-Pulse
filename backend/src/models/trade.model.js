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
    stopLossPaise: {
      type: Number,
      default: null,
    },
    targetPricePaise: {
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
    pnlPaise: {
      type: Number,
      default: null, // Only for SELL trades
    },
    pnlPct: {
      type: Number,
      default: null, // Only for SELL trades
    },

    entryTradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trade",
      default: null,
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
    learningOutcome: new mongoose.Schema({
      verdict: { type: String, enum: ["GOOD", "LUCK", "POOR", "NEUTRAL", "DISCIPLINED_PROFIT", "LUCKY_PROFIT", "DISCIPLINED_LOSS", "POOR_PROCESS"] },
      type: { type: String }, // Mistake Type
      context: { type: String },
      insight: { type: String },
      improvementSuggestion: { type: String },
    }, { _id: false }),
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
    rr: {
      type: Number,
      default: null,
    },
    manualTags: {
      type: [String],
      default: [],
    },
    // --- PART 3: SNAPSHOT INTEGRITY (NEW) ---
    entryPlan: {
      entryPricePaise: { type: Number },
      stopLossPaise: { type: Number },
      targetPricePaise: { type: Number },
      rr: { type: Number },
      intent: { type: String },
      reasoning: { type: String }
    },
    decisionSnapshot: {
      verdict: { type: String },
      score: { type: Number },
      pillars: {
        market: { type: mongoose.Schema.Types.Mixed },
        behavior: { type: mongoose.Schema.Types.Mixed },
        risk: { type: mongoose.Schema.Types.Mixed },
        rr: { type: mongoose.Schema.Types.Mixed }
      }
    },
    trace: {
      timeline: [
        {
          stage: { 
            type: String, 
            enum: ["PRE_TRADE_VALIDATED", "DECISION_GENERATED", "EXECUTION_STARTED", "EXECUTION_COMMITTED", "REFLECTION_COMPLETED"],
            required: true 
          },
          timestamp: { type: Date, default: Date.now },
          metadata: { type: mongoose.Schema.Types.Mixed }
        }
      ]
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

tradeSchema.index({ user: 1, symbol: 1, createdAt: -1 }, { background: true });

const Trade = mongoose.model("Trade", tradeSchema);
module.exports = Trade;
