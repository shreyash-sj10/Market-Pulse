const eventBus = require("../lib/eventBus");
const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const { analyzeReflection } = require("../engines/reflection.engine");
const { analyzeBehavior } = require("./behavior.engine");
const { analyzeProgression } = require("./progression.engine");
const { calculateSkillScore } = require("./skill.engine");
const { normalizeTrade } = require("../domain/trade.contract");
const { mapToClosedTrades } = require("../domain/closedTrade.mapper");
const { runInTransaction } = require("../utils/transaction");
const logger = require("../lib/logger");

const processTradeClosedEvent = async ({ tradeId, userId }) => {
  const _start = Date.now();
  logger.info(`[ReflectionWorker] Start event: TRADE_CLOSED | tradeId: \${tradeId} | userId: \${userId}`);
  
  try {
    await runInTransaction(async (session) => {
      const trade = await Trade.findById(tradeId).session(session);
      if (!trade) return;
      
      // TASK 2 - ADD CORRECT GUARD
      if (trade.reflectionStatus === "DONE") return;
      
      const user = await User.findById(userId).session(session);
      if (!user) return;
      
      const entryTrade = await Trade.findById(trade.entryTradeId).session(session);
      
      // Core Reflection
      const reflection = analyzeReflection({ ...entryTrade.entryPlan, exitPricePaise: trade.pricePaise, pnlPaise: trade.pnlPaise });
      trade.learningOutcome = { verdict: reflection.verdict, insight: reflection.insight, improvementSuggestion: reflection.improvement };
      trade.decisionSnapshot = { verdict: reflection.verdict, score: Math.max(0, 100 - (reflection.deviationScore || 0)), pillars: { market: { verdict: "N/A" }, behavior: { verdict: reflection.verdict }, risk: { verdict: "EXIT" }, rr: { verdict: "N/A" } } };
      trade.intelligenceTimeline = { postTrade: { outcome: reflection.executionPattern, behavioralFlags: reflection.tags } };
      trade.trace.timeline.push({ stage: "REFLECTION_COMPLETED", metadata: { verdict: reflection.verdict } });
      
      const history = await Trade.find({ user: user._id }).sort({ createdAt: 1 }).session(session);
      const normalizedHistory = history.map(t => normalizeTrade(t));
      const closed = mapToClosedTrades(normalizedHistory);
      
      const reflections = closed.map(ct => ct.id === trade.id ? analyzeReflection(ct) : (ct.learningOutcome ? ct : analyzeReflection(ct)));
      const behavior = analyzeBehavior(closed);
      const progression = analyzeProgression(closed);
      const skill = calculateSkillScore(closed, reflections, behavior, progression);

      user.analyticsSnapshot = {
          skillScore: skill.score,
          disciplineScore: behavior.disciplineScore || skill.breakdown.discipline,
          trend: progression.trend || "STABLE",
          tags: [...new Set([...(behavior.patterns || []).map(p => p.type), ...skill.strengths, ...skill.weaknesses])],
          lastUpdated: new Date()
      };
      
      // TASK 3 - FIX STATE TRANSITION
      trade.status = "COMPLETE";
      trade.reflectionStatus = "DONE";
      
      // TASK 4 - ATOMIC WRITE
      await trade.save({ session });
      await user.save({ session });
    });
    
    logger.info(`[Observability] [ReflectionWorker] processing time: \${Date.now() - _start}ms`);
  } catch(e) {
    logger.error(`[ReflectionWorker] Error trade: \${tradeId}: \${e.stack}`);
    throw e; // RE-THROW FOR BULLMQ RETRIES
  }
};

eventBus.on("TRADE_CLOSED", processTradeClosedEvent);
module.exports = { processTradeClosedEvent };
