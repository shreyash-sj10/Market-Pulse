const mongoose = require("mongoose");

const traceSchema = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7776000
  },
  type: {
    type: String,
    enum: ["PLAN", "TRADE", "ANALYSIS"],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // HUMAN-READABLE DECISION TRACE (Hybrid Mode)
  decision: String,
  final_score: Number,
  explanation: String,
  action: String,
  layers: {
    market: { summary: String, reasoning: [String], contribution: Number },
    setup: { summary: String, reasoning: [String], contribution: Number },
    behavior: { summary: String, reasoning: [String], contribution: Number },
    risk: { summary: String, reasoning: [String], contribution: Number }
  },
  // PHASE 3 HUMANIZATION
  humanSummary: {
    decisionSummary: String,
    behaviorFlags: [String],
    reflectionSummary: String,
    riskLevel: String,
    verdict: String,
    simpleExplanation: String
  },
  // TECHNICAL SYSTEM STAGES (Trace_v1)

  stages: {
    interpretation_layer: {
      ml_used: { type: Boolean, default: false },
      ml_confidence: { type: Number, default: 1.0 }
    },
    candidate_generator: {
      input_count: { type: Number, default: 0 },
      output_count: { type: Number, default: 0 }
    },
    constraint_engine: {
      rejected: { type: Number, default: 0 },
      rules_applied: [{ type: String }],
      violations: [{ type: String }]
    },
    scoring_engine: {
      input_count: { type: Number, default: 0 },
      output_count: { type: Number, default: 0 }
    },
    optimizer: {
      combinations_evaluated: { type: Number, default: 0 },
      selected_score: { type: Number, default: 0 }
    },
    reliability_engine: {
      final_output_count: { type: Number, default: 0 }
    }
  },
  metadata: {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    related_id: { type: mongoose.Schema.Types.ObjectId }
  }
});

const Trace = mongoose.model("Trace", traceSchema);
module.exports = Trace;
