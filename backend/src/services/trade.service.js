const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const Holding = require("../models/holding.model");
const ExecutionLock = require("../models/executionLock.model");
const Outbox = require("../models/outbox.model");
const AppError = require("../utils/AppError");
const calculateMistakeAnalysis = require("./mistakeAnalysis.service");
const { generateExplanation, parseTradeIntent, generateFinalTradeCall } = require("./aiExplanation.service");
const { validateSystemInvariants } = require("../utils/invariants");
const Trace = require("../models/trace.model");
const { runInTransaction } = require("../utils/transaction");
const { normalizeTrade } = require("../domain/trade.contract");
const marketDataService = require("./marketData.service");
const { validatePlan, computePnlPct } = require("./risk.engine");
const {
  buildPayloadHash,
  getDecisionRecord,
  consumeDecisionRecord,
} = require("./intelligence/preTradeAuthority.store");

const { mapToClosedTrades } = require("../domain/closedTrade.mapper");
const { analyzeReflection } = require("../engines/reflection.engine");
const { analyzeBehavior } = require("./behavior.engine");
const { analyzeProgression } = require("./progression.engine");
const { calculateSkillScore } = require("./skill.engine");
const { SYSTEM_CONFIG } = require("../config/system.config");
const { isValidStatus } = require("../constants/intelligenceStatus");
const logger = require("../lib/logger");
const eventBus = require("../lib/eventBus");
const { isMarketOpen } = require("./marketHours.service");
const { tradeQueue } = require("../queue/queue");


const normalizeSymbol = (symbol) => {
  if (!symbol) return symbol;
  const s = symbol.toUpperCase().trim();
  if (s.endsWith('.NS') || s.endsWith('.BO')) return s;
  return `${s}.NS`; 
};

const validatePlanOrThrow = (type, pricePaise, stopLossPaise, targetPricePaise) => {
  const result = validatePlan({
    side: type,
    pricePaise,
    stopLossPaise,
    targetPricePaise,
  });
  if (!result.isValid) {
    throw new AppError(result.errorCode, 400);
  }
  return result.rr;
};

const recalculateTotalInvested = (user, holdings) => {
  let totalPaise = 0;
  holdings.forEach((holding) => {
    totalPaise += Math.round((holding.quantity || 0) * (holding.avgPricePaise || 0));
  });
  user.totalInvested = totalPaise;
};


const handleIdempotency = async (userId, requestId) => {
  if (!requestId) {
    throw new AppError("REQUEST_ID_REQUIRED", 400);
  }

  const existingLock = await ExecutionLock.findOne({ requestId });
  if (existingLock) {
    if (existingLock.status === "COMPLETED") {
      return existingLock.responseData;
    }
    throw new AppError("REQUEST_IN_PROGRESS", 429);
  }

  try {
    await ExecutionLock.create({
      requestId,
      userId,
      status: "PENDING"
    });
    return null;
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("REQUEST_IN_PROGRESS", 429);
    }
    throw error;
  }
};

const completeIdempotency = async (requestId, responseData) => {
  await ExecutionLock.findOneAndUpdate(
    { requestId },
    { 
      status: "COMPLETED",
      responseData
    }
  );
};


// ==========================================
// DECOUPLED LIFECYCLE (STAGE 3A)
// ==========================================

const placeOrder = async (userDoc, payload, type = "BUY") => {
  const requestId = payload?.requestId;
  const idemResult = await handleIdempotency(userDoc._id, requestId);
  if (idemResult) return idemResult;

  const now = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [tradesLast24h, lastTrade] = await Promise.all([
    Trade.countDocuments({ user: userDoc._id, createdAt: { $gte: cutoff24h } }),
    Trade.findOne({ user: userDoc._id }).sort({ createdAt: -1 }).lean(),
  ]);
  const lastTradePnL = lastTrade?.pnlPaise ?? null;
  const lastTradeTime = lastTrade?.createdAt ?? null;

  try {
    const tradeTask = async (session) => {
      const { symbol: rawSymbol, quantity, pricePaise, reason, userThinking, rawIntent, intent, manualTags, token } = payload;
      const symbol = normalizeSymbol(rawSymbol);

      if (!token) throw new AppError("PRE_TRADE_REQUIRED", 400);

      const record = await getDecisionRecord(token);
      if (!record) throw new AppError("INVALID_TOKEN", 400);

      const currentPayloadHash = buildPayloadHash({
        symbol, pricePaise, quantity,
        stopLossPaise: payload.stopLossPaise || null,
        targetPricePaise: payload.targetPricePaise || null,
      });

      if (record.payloadHash !== currentPayloadHash) throw new AppError("PAYLOAD_MISMATCH", 400);
      if (record.verdict === "WAIT" || record.verdict === "AVOID") throw new AppError("TRADE_BLOCKED_BY_DECISION_ENGINE", 400);

      await consumeDecisionRecord(token);

      const validation = await marketDataService.validateSymbol(symbol);
      if (!validation.isValid || !pricePaise || pricePaise <= 0) throw new AppError("INVALID_MARKET_DATA_INTERCEPTED", 400);
      if (!quantity || quantity <= 0) throw new AppError("QUANTITY_MUST_BE_POSITIVE", 400);

      const user = await User.findById(userDoc._id).session(session);
      const totalValuePaise = quantity * pricePaise;

      let tradeObj = {
        user: user._id,
        idempotencyKey: requestId,
        symbol,
        type,
        quantity,
        pricePaise,
        totalValuePaise,
        reason,
        userThinking,
        rawIntent: rawIntent || intent,
        intent,
        manualTags: manualTags || [],
        status: "PENDING_EXECUTION",
        queuedAt: new Date(),
        executionTime: null
      };

      if (type === "BUY") {
        const { stopLossPaise, targetPricePaise, intelligenceTimeline: preTrade } = payload;
        const rr = validatePlanOrThrow("BUY", pricePaise, stopLossPaise, targetPricePaise);

        const availableBalanceForBuy = user.balance - (user.reservedBalancePaise || 0);
        if (!user || availableBalanceForBuy < totalValuePaise) throw new AppError("TERMINAL_FUNDING_SHORTFALL", 400);

        // RESERVE BALANCE
        user.reservedBalancePaise = (user.reservedBalancePaise || 0) + totalValuePaise;
        await user.save({ session });

        
        Object.assign(tradeObj, {
          analysis: null, pnlPaise: tradePnLPaise, pnlPct: computePnlPct(tradePnLPaise, costBasisPaise),
          entryTradeId: entryTrade._id, stopLossPaise: entryTrade.stopLossPaise || null, targetPricePaise: entryTrade.targetPricePaise || null, rr,
          learningOutcome: null,
          entryPlan: { entryPricePaise: entryTrade.pricePaise || currentHolding.avgPricePaise, stopLossPaise: entryTrade.stopLossPaise || 0, targetPricePaise: entryTrade.targetPricePaise || 0, rr, intent: "LIQUIDATION", reasoning: userThinking || "" },
          decisionSnapshot: null,
          intelligenceTimeline: null,
          trace: { timeline: [] }
        });

      }

      const [trade] = await Trade.create([tradeObj], { session });

      const result = { trade: normalizeTrade((trade.type === 'SELL') ? { ...trade.toObject(), openedAt: (await Trade.findById(trade.entryTradeId)).createdAt } : trade), updatedBalance: user.balance };
      if (requestId && !isMarketOpen()) {
        await completeIdempotency(requestId, result);
      }
      return result;
    };
    return await runInTransaction(tradeTask);
  } catch (error) {
    if (requestId) await ExecutionLock.deleteOne({ requestId, status: "PENDING" });
    throw error;
  }
};

const executeOrder = async (tradeId) => {
  return await runInTransaction(async (session) => {
    const trade = await Trade.findOneAndUpdate(
      { _id: tradeId, status: "PENDING_EXECUTION" },
      { status: "PROCESSING" },
      { new: true, session }
    );
    if (!trade) return null;

    const user = await User.findById(trade.user).session(session);

    if (trade.type === "BUY") {
      user.balance -= trade.totalValuePaise;
      user.reservedBalancePaise -= trade.totalValuePaise;
      if (user.reservedBalancePaise < 0) user.reservedBalancePaise = 0; // fallback safety
      
      await Holding.findOneAndUpdate(
        { userId: user._id, symbol: trade.symbol },
        [
          {
            $set: {
              userId: { $ifNull: ["$userId", user._id] },
              symbol: { $ifNull: ["$symbol", trade.symbol] },
              quantity: { $add: [{ $ifNull: ["$quantity", 0] }, trade.quantity] },
              avgPricePaise: {
                $let: {
                  vars: {
                    oldQty: { $ifNull: ["$quantity", 0] },
                    oldAvg: { $ifNull: ["$avgPricePaise", 0] },
                    buyQty: trade.quantity,
                    buyPrice: trade.pricePaise,
                  },
                  in: {
                    $round: [
                      { $divide: [ { $add: [ { $multiply: ["$$oldQty", "$$oldAvg"] }, { $multiply: ["$$buyQty", "$$buyPrice"] } ] }, { $add: ["$$oldQty", "$$buyQty"] } ] }, 0
                    ],
                  },
                },
              },
              updatedAt: "$$NOW",
            },
          },
        ],
        { upsert: true, updatePipeline: true, session }
      );

      await Trace.create([{
        type: "PLAN",
        humanSummary: { decisionSummary: `Entry position established for ${trade.symbol} at ₹${(trade.pricePaise/100).toFixed(2)}.`, riskLevel: "SYSTEM_APPROVED", verdict: "AUTHORIZED", simpleExplanation: "Institutional trade passed all pre-flight risk constraints." },
        stages: { constraint_engine: { rejected: 0, rules_applied: ["BALANCE_CHECK", "PRICE_INTEGRITY"], violations: [] } },
        metadata: { user: user._id, related_id: trade._id }
      }], { session });

    } else {
      // SELL
      const currentHolding = await Holding.findOne({ userId: user._id, symbol: trade.symbol }).session(session);
      if (!currentHolding || currentHolding.quantity < trade.quantity) throw new AppError("INSUFFICIENT_QUANTITY", 400);

      user.balance += trade.totalValuePaise;
      user.realizedPnL = (user.realizedPnL || 0) + trade.pnlPaise;

      const remainingQty = currentHolding.quantity - trade.quantity;
      if (remainingQty <= 0) {
        await Holding.deleteOne({ _id: currentHolding._id }).session(session);
      } else {
        currentHolding.quantity = remainingQty;
        currentHolding.updatedAt = new Date();
        await currentHolding.save({ session });
      }

      await Trace.create([{
        type: "ANALYSIS",
        humanSummary: { decisionSummary: `Liquidation of ${trade.symbol} at ₹${(trade.pricePaise/100).toFixed(2)}.`, behaviorFlags: trade.intelligenceTimeline?.postTrade?.behavioralFlags || [], reflectionSummary: trade.learningOutcome?.insight || "", riskLevel: "MITIGATED", verdict: trade.decisionSnapshot?.verdict || "CLOSED", simpleExplanation: `Position closed.` },
        stages: { constraint_engine: { rejected: 0, rules_applied: ["HOLDING_CHECK"], violations: [] } },
        metadata: { user: user._id, related_id: trade._id }
      }], { session });

      // Analytics Recalibration
      const history = await Trade.find({ user: user._id }).sort({ createdAt: 1 }).session(session);
      const normalizedHistory = history.map(t => normalizeTrade(t));
      const closed = mapToClosedTrades(normalizedHistory);
      const reflections = closed.map(ct => analyzeReflection(ct));
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
    }

    trade.status = trade.type === "SELL" ? "EXECUTED_PENDING_REFLECTION" : "EXECUTED";
    trade.reflectionStatus = trade.type === "SELL" ? "PENDING" : null;
    trade.executionTime = new Date();
    trade.trace.timeline.push({ stage: "EXECUTION_STARTED" }, { stage: "EXECUTION_COMMITTED", metadata: { txId: Date.now() } });
    await trade.save({ session });

    await user.save({ session });

    if (trade.type === "SELL") {
      await Outbox.create([{
        type: "TRADE_CLOSED",
        payload: { tradeId: trade._id.toString(), userId: user._id.toString() }
      }], { session });
    }

    const holdings = await Holding.find({ userId: user._id }).session(session);
    recalculateTotalInvested(user, holdings);
    validateSystemInvariants(user, holdings);
    await user.save({ session });

    const result = { trade: normalizeTrade(trade), updatedBalance: user.balance };
    if (trade.idempotencyKey) {
      await completeIdempotency(trade.idempotencyKey, result);
    }
    return result;
  });
};


const executeBuyTrade = async (userDoc, payload) => {
   const placeResult = await placeOrder(userDoc, payload, "BUY");
   if (isMarketOpen()) {
       return await executeOrder(placeResult.trade.id);
   }
   return placeResult;
};

const executeSellTrade = async (userDoc, payload) => {
   const _start = Date.now();
   const placeResult = await placeOrder(userDoc, payload, "SELL");
   let res = placeResult;
   if (isMarketOpen()) {
       res = await executeOrder(placeResult.trade.id);
   }
   logger.info(`[Observability] executeSellTrade latency: ${Date.now() - _start}ms`);
   return res;
};

module.exports = { executeBuyTrade, executeSellTrade, placeOrder, executeOrder };
module.exports.__testables = { validatePlanOrThrow };
