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
const { generateReflectionSummary, translateBehavior } = require("./aiExplanation.service");
const { generateLesson } = require("./lessonGenerator");
const { generatePatternInsight } = require("./patternInsight.service");
const { translateTags } = require("../utils/behaviorTranslator");
const logger = require("../lib/logger");

const processTradeClosedEvent = async ({ tradeId, userId }) => {
  const _start = Date.now();
  logger.info(`[ReflectionWorker] Start event: TRADE_CLOSED | tradeId: ${tradeId} | userId: ${userId}`);
  
  // ─── PHASE 1: DETERMINISTIC REFLECTION (Retry-Safe via DB transaction) ────────
  // This block is the ONLY part that runs on BullMQ retry.
  // AI is NOT inside this block — retries cannot cause duplicate AI calls.
  try {
    await runInTransaction(async (session) => {
      const trade = await Trade.findById(tradeId).session(session);
    if (!trade) return;
    
    // Idempotency guard: DONE status means this job already completed, skip entirely
    if (trade.reflectionStatus === "DONE") return;
    
    const user = await User.findById(userId).session(session);
    if (!user) return;
    
    const entryTrade = await Trade.findById(trade.entryTradeId).session(session);
    
    // PHASE 4 FIX: Explicitly resolve entry price with fallback chain.
    // entryTrade.entryPlan may store the price as entryPricePaise or pricePaise.
    // We override it explicitly instead of relying on blind spread to avoid silent 0.
    const safeEntryPrice =
      entryTrade?.entryPlan?.entryPricePaise ??
      entryTrade?.entryPlan?.pricePaise ??
      entryTrade?.pricePaise ??
      0;

    // Core Reflection
    const reflection = analyzeReflection({
      ...entryTrade?.entryPlan,
      entryPricePaise: safeEntryPrice,      // explicit override — always present
      exitPricePaise: trade.pricePaise,
      pnlPaise: trade.pnlPaise
    });
    trade.learningOutcome = {
      verdict: reflection.verdict,
      insight: reflection.insight,
      improvementSuggestion: reflection.improvement
    };
    trade.decisionSnapshot = {
      verdict: reflection.verdict,
      score: Math.max(0, 100 - (reflection.deviationScore || 0)),
      pillars: {
        market: { verdict: "N/A" },
        behavior: { verdict: reflection.verdict },
        risk: { verdict: "EXIT" },
        rr: { verdict: "N/A" }
      }
    };
    trade.intelligenceTimeline = {
      postTrade: { outcome: reflection.executionPattern, behavioralFlags: reflection.tags }
    };
    trade.trace.timeline.push({ stage: "REFLECTION_COMPLETED", metadata: { verdict: reflection.verdict } });

    // PHASE 5: Generate exactly ONE lesson per trade (deterministic — no AI)
    const lesson = generateLesson(trade, reflection);
    trade.lesson = lesson;

    // PHASE 6: Attach human-readable behavior translations (deterministic)
    trade.behaviorTranslation = translateTags(reflection.tags || []);
    
    const history = await Trade.find({ user: user._id }).sort({ createdAt: 1 }).session(session);
    const normalizedHistory = history.map(t => normalizeTrade(t));
    const closed = mapToClosedTrades(normalizedHistory);
    
    // PHASE 2+3 FIX: Pure reflections[] — every element is a reflection output, never a raw ClosedTrade.
    // The previous shortcut `ct.learningOutcome ? ct : analyzeReflection(ct)` injected raw ClosedTrade
    // objects (which have no deviationScore field), silently contributing 0 to discipline scoring.
    // Per-trade try/catch prevents a single bad input from crashing the whole transaction.
    const reflections = closed.map(ct => {
      try {
        return analyzeReflection(ct);
      } catch (e) {
        logger.warn({ action: "REFLECTION_SKIPPED", tradeId: ct.id, reason: e.message });
        return null;
      }
    }).filter(Boolean); // Strip nulls — failed trades excluded from scoring cleanly
    const behavior = analyzeBehavior(closed);
    const progression = analyzeProgression(closed);
    const skill = calculateSkillScore(closed, reflections, behavior, progression);

    user.analyticsSnapshot = {
      skillScore: skill.score,
      disciplineScore: behavior.disciplineScore || skill.breakdown.discipline,
      trend: progression.trend || "STABLE",
      tags: [...new Set([...(behavior.patterns || []).map(p => p.type), ...skill.strengths, ...skill.weaknesses])],
      lastUpdated: new Date(),
      // PHASE 7: Attach deterministic pattern insight to snapshot
      patternInsight: generatePatternInsight({
        tags: [...new Set([...(behavior.patterns || []).map(p => p.type), ...skill.strengths, ...skill.weaknesses])],
        totalTrades: closed.length,
        winRate: behavior.winRate || 0,
        avgPnlPct: behavior.avgPnlPct || 0,
        disciplineScore: behavior.disciplineScore || skill.breakdown?.discipline || 0,
      }),
    };
    
    trade.status = "COMPLETE";
    trade.reflectionStatus = "DONE";
    
      await trade.save({ session });
      await user.save({ session });
    });
  } catch (e) {
    logger.error("Reflection worker failed", e);
    throw e; // MUST rethrow for queue retry
  }

  logger.info(`[Observability] [ReflectionWorker] deterministic reflection time: ${Date.now() - _start}ms`);

  // ─── PHASE 2: AI POST-PROCESSING (Non-Blocking, NOT part of retry loop) ──────
  // This block is intentionally outside runInTransaction.
  // If THIS block fails, the error is caught here — it does NOT re-throw,
  // so BullMQ does NOT retry. AI failure is always non-fatal.

  // PHASE 2A: Generate and store AI reflection summary for the closed trade
  try {
    const finishedTrade = await Trade.findById(tradeId);
    if (finishedTrade && finishedTrade.reflectionStatus === "DONE") {
      // BUG-11 FIX: Use the ACTUAL entry trade price (different from exit price)
      const entryTrade = await Trade.findById(finishedTrade.entryTradeId);
      const entryPricePaise = entryTrade?.pricePaise || finishedTrade.pricePaise;
      const exitPricePaise = finishedTrade.pricePaise;

      const aiSummary = await generateReflectionSummary({
        entryPrice: entryPricePaise,
        exitPrice: exitPricePaise,
        pnlPct: finishedTrade.pnlPct || 0,
        behaviorTag: finishedTrade.learningOutcome?.verdict || "UNKNOWN",
        deviation: finishedTrade.learningOutcome?.improvementSuggestion || "None"
      });

      if (aiSummary && aiSummary.meta) {
        delete aiSummary.meta.generatedAt;
      }

      const { buildLearningSurface } = require("../engines/learning.engine");
      const learningSurface = buildLearningSurface({
        closedTrade: finishedTrade,
        reflection: {
          mistakeTag: finishedTrade.intelligenceTimeline?.postTrade?.outcome,
          deviationScore: finishedTrade.decisionSnapshot?.score ? 100 - finishedTrade.decisionSnapshot.score : 0,
        },
        behavior: null,
        mistakeAnalysis: { primaryMistake: finishedTrade.intelligenceTimeline?.postTrade?.outcome },
        aiSummary
      });

      finishedTrade.learningSurface = learningSurface;
      finishedTrade.ai = aiSummary;
      finishedTrade.aiSummary = aiSummary;
      await finishedTrade.save();
      logger.info({ action: "AI_REFLECTION_SAVED", tradeId });
    }
  } catch (aiErr) {
    // BUG-10 FIX: AI errors DO NOT propagate — BullMQ must NOT retry for AI failures
    logger.error({ action: "AI_REFLECTION_FAILED", tradeId, error: aiErr.message });
  }

};

eventBus.on("TRADE_CLOSED", processTradeClosedEvent);
module.exports = { processTradeClosedEvent };
