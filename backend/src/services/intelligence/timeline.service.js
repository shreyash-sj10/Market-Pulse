const Trade = require("../../models/trade.model");
const preTradeGuard = require("./preTradeGuard.service");
const { analyzeReflection } = require("../../engines/reflection.engine");

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
  const reflection = analyzeReflection({
    symbol: trade.symbol,
    entryPricePaise: trade.entryPlan?.entryPricePaise || trade.pricePaise,
    exitPricePaise: closeRequest?.pricePaise,
    stopLossPaise: trade.entryPlan?.stopLossPaise || trade.stopLossPaise,
    targetPricePaise: trade.entryPlan?.targetPricePaise || trade.targetPricePaise,
    pnlPaise: closeRequest?.pnlPaise || trade.pnlPaise || 0,
    entryTime: new Date(trade.openedAt || trade.createdAt).getTime(),
    exitTime: Date.now(),
    behaviorTags: trade.analysis?.mistakeTags || [],
  });
  
  const learningTags = [...(reflection.tags || [])];

  return {
    postTrade: {
      outcome: reflection.executionPattern,
      alignment: reflection.verdict,
      observations: [reflection.insight],
      behavioralFlags: reflection.tags || [],
      insightSummary: reflection.insight
    },
    learningTags,
    trace: [...(trade.intelligenceTimeline?.trace || []), `Reflection: Trade classified as ${reflection.verdict}.`]
  };
};

module.exports = { getTimelineMap, integratePreTrade, integratePostTrade };
