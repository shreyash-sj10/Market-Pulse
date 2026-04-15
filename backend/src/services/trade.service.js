const { calculatePct, enforcePaise } = require("../utils/paise");
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

const cleanupStaleReservations = async (userId, session) => {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 mins
  const staleTrades = await Trade.find({
    user: userId,
    status: "PENDING_EXECUTION",
    createdAt: { $lt: cutoff }
  }).session(session);

  if (staleTrades.length > 0) {
    const user = await User.findById(userId).session(session);
    for (const trade of staleTrades) {
      user.reservedBalancePaise -= trade.totalValuePaise;
      trade.status = "FAILED_TIMEOUT";
      await trade.save({ session });
    }
    if (user.reservedBalancePaise < 0) user.reservedBalancePaise = 0;
    await user.save({ session });
  }
};


const handleIdempotency = async (userId, requestId) => {
  if (!requestId) {
    throw new AppError("REQUEST_ID_REQUIRED", 400);
  }

  const existingLock = await ExecutionLock.findOne({ userId, requestId });
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

const completeIdempotency = async (userId, requestId, responseData) => {
  await ExecutionLock.findOneAndUpdate(
    { userId, requestId },
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

  // Safe Patch: Self-healing reservation cleanup
  await runInTransaction(async (session) => {
    await cleanupStaleReservations(userDoc._id, session);
  });

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
      const { symbol: rawSymbol, quantity, reason, userThinking, rawIntent, intent, manualTags, token } = payload;
      const clientPricePaise = enforcePaise(payload.pricePaise, "pricePaise");
      const symbol = normalizeSymbol(rawSymbol);

      if (!token) throw new AppError("PRE_TRADE_REQUIRED", 400);

      const record = await getDecisionRecord(token);
      if (!record) throw new AppError("INVALID_TOKEN", 400);
      if (!record.userId || String(record.userId) !== String(userDoc._id)) {
        throw new AppError("TOKEN_USER_MISMATCH", 403);
      }

      const currentPayloadHash = buildPayloadHash({
        symbol, pricePaise: clientPricePaise, quantity,
        stopLossPaise: payload.stopLossPaise || null,
        targetPricePaise: payload.targetPricePaise || null,
      });

      if (record.payloadHash !== currentPayloadHash) throw new AppError("PAYLOAD_MISMATCH", 400);
      if (record.verdict === "WAIT" || record.verdict === "AVOID") throw new AppError("TRADE_BLOCKED_BY_DECISION_ENGINE", 400);

      await consumeDecisionRecord(token);

      let resolvedPrice;
      try {
        resolvedPrice = await marketDataService.resolvePrice(symbol);
      } catch (error) {
        throw new AppError("MARKET_DATA_UNAVAILABLE", 503);
      }
      const pricePaise = enforcePaise(resolvedPrice?.pricePaise, "execution_price");
      if (!pricePaise || pricePaise <= 0) throw new AppError("INVALID_MARKET_DATA_INTERCEPTED", 400);
      const priceSource = resolvedPrice?.source || "REAL";
      logger.info({
        action: "PRICE_TRANSPARENCY_AUDIT",
        symbol,
        requestId,
        clientPricePaise,
        executionPricePaise: pricePaise,
        source: priceSource,
      });
      if (!quantity || quantity <= 0) throw new AppError("QUANTITY_MUST_BE_POSITIVE", 400);

      const user = await User.findById(userDoc._id).session(session);
      const totalValuePaise = Math.round(quantity * pricePaise);

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
        priceSource: priceSource,
        queuedAt: new Date(),
        executionTime: null
      };

      if (type === "BUY") {
        const stopLossPaise = payload.stopLossPaise ? enforcePaise(payload.stopLossPaise, "stopLossPaise") : null;
        const targetPricePaise = payload.targetPricePaise ? enforcePaise(payload.targetPricePaise, "targetPricePaise") : null;
        
        // Skip re-computation/blocking if we have a valid token (Trust the engine)
        let rr;
        if (record) {
          const { calculateRR } = require("./risk.engine");
          rr = calculateRR(pricePaise, stopLossPaise, targetPricePaise);
        } else {
          rr = validatePlanOrThrow("BUY", pricePaise, stopLossPaise, targetPricePaise);
        }

        const availableBalanceForBuy = user.balance - (user.reservedBalancePaise || 0);
        if (!user || availableBalanceForBuy < totalValuePaise) throw new AppError("TERMINAL_FUNDING_SHORTFALL", 400);

        // RESERVE BALANCE
        user.reservedBalancePaise = (user.reservedBalancePaise || 0) + totalValuePaise;
        await user.save({ session });

        Object.assign(tradeObj, { 
          stopLossPaise, 
          targetPricePaise, 
          rr,
          entryPlan: {
             entryPricePaise: pricePaise,
             stopLossPaise,
             targetPricePaise,
             rr,
             intent: intent || rawIntent,
             reasoning: reason || userThinking
          }
        });

      } else {
        // SELL Lifecycle
        const currentHolding = await Holding.findOne({ userId: user._id, symbol: tradeObj.symbol }).session(session);
        if (!currentHolding || currentHolding.quantity < quantity) throw new AppError("INSUFFICIENT_QUANTITY", 400);
        const avgHoldingPricePaise = enforcePaise(currentHolding.avgPricePaise, "holding.avgPricePaise");

        const entryTrade = await Trade.findOne({ user: user._id, symbol, type: "BUY", status: "EXECUTED" }).sort({ createdAt: -1 }).session(session);
        if (!entryTrade) throw new AppError("ENTRY_TRADE_NOT_FOUND: No active position found for this symbol.", 404);

        const costBasisPaise = Math.round(quantity * avgHoldingPricePaise);
        const tradePnLPaise = totalValuePaise - costBasisPaise;

        Object.assign(tradeObj, {
          entryTradeId: entryTrade._id,
          pnlPaise: tradePnLPaise,
          pnlPct: calculatePct(tradePnLPaise, costBasisPaise),
          entryPlan: {
             entryPricePaise: avgHoldingPricePaise,
             intent: intent || rawIntent,
             reasoning: reason || userThinking
          }
        });
      }

      const [trade] = await Trade.create([tradeObj], { session });

      const finalTrade = trade.toObject();
      if (type === 'SELL') {
        const entry = await Trade.findById(trade.entryTradeId).lean();
        finalTrade.openedAt = entry?.createdAt;
      }

      const result = { trade: normalizeTrade(finalTrade), updatedBalance: user.balance };
      if (requestId && !isMarketOpen()) {
        await completeIdempotency(userDoc._id, requestId, result);
      }
      return result;
    };
    return await runInTransaction(tradeTask);
  } catch (error) {
    if (requestId) await ExecutionLock.deleteOne({ userId: userDoc._id, requestId, status: "PENDING" });
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

    const liveExecution = await marketDataService.resolvePrice(trade.symbol);
    const executionPricePaise = enforcePaise(liveExecution?.pricePaise, "execution_price");
    if (!executionPricePaise || executionPricePaise <= 0) {
      throw new AppError("INVALID_MARKET_DATA_INTERCEPTED", 400);
    }

    trade.pricePaise = executionPricePaise;
    trade.priceSource = liveExecution?.source || "REAL";
    trade.totalValuePaise = Math.round(trade.quantity * executionPricePaise);

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

      const avgHoldingPricePaise = enforcePaise(currentHolding.avgPricePaise, "holding.avgPricePaise");
      const costBasisPaise = Math.round(trade.quantity * avgHoldingPricePaise);
      trade.pnlPaise = trade.totalValuePaise - costBasisPaise;
      trade.pnlPct = calculatePct(trade.pnlPaise, costBasisPaise);

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

      // Analytics Recalibration (Safe Patch: Limit history to O(100) to prevent chokepoint)
      const history = await Trade.find({ user: user._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
        .session(session);
      
      const chronHistory = [...history].reverse();
      const normalizedHistory = chronHistory.map(t => normalizeTrade(t));
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
        payload: { tradeId: trade._id.toString(), userId: user._id.toString() },
        status: "PENDING",
      }], { session });

      const pendingThreshold = Number(process.env.OUTBOX_PENDING_CRITICAL_THRESHOLD || 500);
      const pendingCount = await Outbox.countDocuments({ status: "PENDING" }).session(session);
      if (pendingCount > pendingThreshold) {
        logger.error({
          severity: "CRITICAL",
          action: "OUTBOX_PENDING_BACKPRESSURE",
          pendingCount,
          threshold: pendingThreshold,
        });
      }
    }

    const holdings = await Holding.find({ userId: user._id }).session(session);
    recalculateTotalInvested(user, holdings);
    validateSystemInvariants(user, holdings);
    await user.save({ session });

    const result = { trade: normalizeTrade(trade), updatedBalance: user.balance };
    if (trade.idempotencyKey) {
      await completeIdempotency(user._id, trade.idempotencyKey, result);
    }
    return result;
  });
};


const executeBuyTrade = async (userDoc, payload) => {
   const placeResult = await placeOrder(userDoc, payload, "BUY");
   if (isMarketOpen()) {
       return await executeOrder(placeResult.trade.tradeId);
   }
   return placeResult;
};

const executeSellTrade = async (userDoc, payload) => {
   const _start = Date.now();
   const placeResult = await placeOrder(userDoc, payload, "SELL");
   let res = placeResult;
   if (isMarketOpen()) {
       res = await executeOrder(placeResult.trade.tradeId);
   }
   logger.info(`[Observability] executeSellTrade latency: ${Date.now() - _start}ms`);
   return res;
};

module.exports = { executeBuyTrade, executeSellTrade, placeOrder, executeOrder };
module.exports.__testables = { validatePlanOrThrow };
