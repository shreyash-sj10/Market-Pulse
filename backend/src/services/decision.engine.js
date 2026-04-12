const aiService = require("./aiExplanation.service");
const scoringEngine = require("./scoring.engine");
const mistakeAnalysis = require("./mistakeAnalysis.service");
const Trace = require("../models/trace.model");

/**
 * FINAL TRADE CALL ENGINE (HYBRID)
 * AI: Synthesized Reasoning
 * Rules: Deterministic Verdict
 */

const generateFinalTradeCall = async (tradeData, marketContext, behaviorProfile) => {
  // 1. Setup Input Blocks (Rule Engine Prep)
  const setupScore = tradeData.setupScore || 70;
  const riskStats = mistakeAnalysis({
    tradeValue: tradeData.totalValuePaise || 0,
    balanceBeforeTrade: tradeData.balance || 1000000,
    stopLoss: tradeData.stopLoss,
    targetPrice: tradeData.targetPrice,
    entryPrice: tradeData.pricePaise,
    tradesLast24h: behaviorProfile.tradesCount24h || 0,
    lastTradePnL: behaviorProfile.lastPnL || 0,
    lastTradeTime: behaviorProfile.lastTradeTime
  });

  const inputs = {
    market: {
      direction: marketContext.impact || "NEUTRAL",
      confidence: marketContext.confidence || 50,
      reason: marketContext.mechanism || marketContext.explanation || "Ambiguous market vector."
    },
    setup: {
      type: tradeData.strategy || "BREAKOUT",
      score: setupScore,
      reason: tradeData.reason || "Technical alignment with pattern."
    },
    behavior: {
      risk: behaviorProfile.dominantMistake || "None",
      score: 100 - (behaviorProfile.consistencyScore || 0),
      reason: behaviorProfile.summary || "Stable behavioral profile."
    },
    risk: {
      level: riskStats.riskScore > 60 ? "HIGH" : riskStats.riskScore > 30 ? "MEDIUM" : "LOW",
      score: riskStats.riskScore,
      reason: riskStats.mistakeTags.join(", ") || "Risk parameters within limits."
    },
    finalScore: Math.round((setupScore + marketContext.confidence + (100 - riskStats.riskScore)) / 3)
  };

  // 2. Deterministic Verdict (RULE ENGINE)
  let verdict = "WAIT";
  if (inputs.finalScore > 75 && inputs.risk.level !== "HIGH") {
    verdict = "BUY";
  } else if (inputs.risk.level === "HIGH") {
    verdict = "AVOID";
  } else if (inputs.finalScore > 50) {
    verdict = "CAUTION";
  } else {
    verdict = "WAIT";
  }

  // 3. AI Synthesis (AI ASSISTIVE)
  const aiCall = await aiService.generateFinalTradeCall(inputs, { verdict, score: inputs.finalScore });

  // 4. Record DECISION TRACE (Persistence)
  const decisionTrace = {
    type: "ANALYSIS",
    decision: verdict,
    final_score: inputs.finalScore,
    explanation: aiCall.reasoning,
    action: aiCall.suggestedAction,
    layers: {
       market: { 
         summary: `Direction: ${inputs.market.direction} (${inputs.market.confidence}%)`, 
         reasoning: [inputs.market.reason],
         contribution: marketContext.confidence / 3
       },
       setup: {
         summary: `Strategy: ${inputs.setup.type} / Grade: ${setupScore}`,
         reasoning: [inputs.setup.reason],
         contribution: setupScore / 3
       },
       behavior: {
         summary: `Risk: ${inputs.behavior.risk} / Consistency: ${behaviorProfile.consistencyScore}%`,
         reasoning: [inputs.behavior.reason],
         contribution: (100 - inputs.behavior.score) / 3
       },
       risk: {
         summary: `Level: ${inputs.risk.level} / Risk Score: ${inputs.risk.score}`,
         reasoning: riskStats.mistakeTags.length > 0 ? riskStats.mistakeTags : ["No catastrophic violations detected."],
         contribution: (100 - inputs.risk.score) / 3
       }
    },
    metadata: {
      user: tradeData.userId,
      related_id: tradeData._id
    }
  };

  await Trace.create(decisionTrace);

  return {
    ...aiCall,
    inputs
  };
};

module.exports = { generateFinalTradeCall };
