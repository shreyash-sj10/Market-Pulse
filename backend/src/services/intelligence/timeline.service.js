const Trade = require("../../models/trade.model");
const preTradeGuard = require("./preTradeGuard.service");
const reflectionEngine = require("./reflectionEngine.service");

/**
 * UNIFIED TRADER INTELLIGENCE TIMELINE — SYSTEM INTEGRATOR
 */

const getTimelineMap = async (userId) => {
  const trades = await Trade.find({ user: userId }).sort({ createdAt: -1 }).limit(10);
  
  // 1. Detect Patterns (Cross-Trade Memory)
  const tagCounts = {};
  trades.forEach(t => {
     (t.intelligenceTimeline?.learningTags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
     });
  });

  const patterns = Object.keys(tagCounts).filter(tag => tagCounts[tag] >= 3).map(tag => ({
     tag,
     count: tagCounts[tag],
     insight: `Pattern detected: You have triggered ${tag.replace(/_/g, ' ')} in ${tagCounts[tag]} of your last 10 trades.`
  }));

  return {
    recentTrades: trades,
    patterns,
    summary: `System analyzed ${trades.length} recent executions. Found ${patterns.length} recurring behavioral anchors.`
  };
};

const integratePreTrade = async (tradeRequest, user) => {
  const riskReport = await preTradeGuard.checkTradeRisk(tradeRequest, user);
  return {
    riskLevel: riskReport.riskLevel,
    flags: riskReport.flags,
    reasoning: riskReport.reasoning,
    trace: [`Intercepted: ${riskReport.riskLevel} risk detected at pre-trade.`]
  };
};

const integratePostTrade = async (trade, closeRequest) => {
  const reflection = await reflectionEngine.generateReflection(trade, closeRequest);
  
  const learningTags = [...reflection.learningTags];
  if (reflection.alignment === "AGAINST_TREND") learningTags.push("TREND_IGNORED");
  if (reflection.behavioralFlags.includes("PANIC_EXIT_SIGNAL")) learningTags.push("EARLY_EXIT");

  return {
    postTrade: {
      outcome: reflection.outcome,
      alignment: reflection.alignment,
      observations: reflection.keyObservations,
      behavioralFlags: reflection.behavioralFlags,
      insightSummary: reflection.insightSummary
    },
    learningTags,
    trace: [...(trade.intelligenceTimeline?.trace || []), `Reflection: Trade closed as ${reflection.outcome} with ${reflection.alignment} alignment.`]
  };
};

module.exports = { getTimelineMap, integratePreTrade, integratePostTrade };
