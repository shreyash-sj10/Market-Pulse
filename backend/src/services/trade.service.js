const crypto = require("crypto");
const { calculatePct, enforcePaise } = require("../utils/paise");
const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const Holding = require("../models/holding.model");
const ExecutionLock = require("../models/executionLock.model");
const PreTradeToken = require("../models/preTradeToken.model");
const Outbox = require("../models/outbox.model");
const redisClient = require("../utils/redisClient");
const AppError = require("../utils/AppError");
const calculateMistakeAnalysis = require("./mistakeAnalysis.service");
const { validateSystemInvariants } = require("../utils/invariants");
const Trace = require("../models/trace.model");
const { runInTransaction } = require("../utils/transaction");
const { normalizeTrade } = require("../domain/trade.contract");
const { normalizeSymbol } = require("../utils/symbol.utils");
const { getPrice } = require("./price.engine");
const { validatePlan, computePnlPct } = require("./risk.engine");
const { buildPayloadHash } = require("./intelligence/preTradeAuthority.store");

const { SYSTEM_CONFIG } = require("../config/system.config");
const { isValidStatus } = require("../constants/intelligenceStatus");
const logger = require("../utils/logger");
const { flowLog } = require("../utils/flowLog");
const { getTraceId } = require("../context/traceContext");
const eventBus = require("../utils/eventBus");
const { isMarketOpen } = require("./marketHours.service");
const { tradeQueue } = require("../queue/queue");

function attachExecutionDecisionContext(tradeObj, payload, record) {
  const dc = payload?.decisionContext;
  if (!dc || typeof dc !== "object" || Array.isArray(dc)) return;
  const verdict = typeof dc.verdict === "string" ? dc.verdict.slice(0, 64) : undefined;
  const score = typeof dc.score === "number" && Number.isFinite(dc.score) ? dc.score : undefined;
  const engineAction =
    typeof dc.marketSignal === "string" && /^(ACT|GUIDE|BLOCK)$/.test(dc.marketSignal) ? dc.marketSignal : undefined;
  if (verdict != null || score != null || engineAction) {
    tradeObj.decisionSnapshot = {
      verdict: verdict || undefined,
      score: score ?? undefined,
      pillars: engineAction ? { engine: { action: engineAction } } : {},
    };
  }
  const reasoning = [];
  if (typeof dc.thesis === "string" && dc.thesis.trim()) reasoning.push(`Thesis: ${dc.thesis.trim().slice(0, 500)}`);
  const bl = dc.behavioralLoop;
  if (bl && typeof bl === "object" && bl.systemVerdict) {
    reasoning.push(`System posture: ${String(bl.systemVerdict).slice(0, 200)}`);
  }
  if (reasoning.length === 0 && !record?.verdict) return;
  tradeObj.intelligenceTimeline = {
    preTrade: {
      riskLevel: record?.verdict || undefined,
      flags: [],
      reasoning: reasoning.length ? reasoning : record?.verdict ? [`Authority: ${record.verdict}`] : [],
    },
    postTrade: {
      outcome: undefined,
      alignment: undefined,
      observations: [],
      behavioralFlags: [],
      insightSummary: undefined,
    },
    learningTags: [],
    trace: [],
  };
}

function buildTraceSystemExplain(tradeDoc) {
  const t = tradeDoc && typeof tradeDoc.toObject === "function" ? tradeDoc.toObject() : tradeDoc;
  const ruleTriggers =
    t.type === "SELL"
      ? ["BALANCE_CHECK", "PRICE_INTEGRITY", "HOLDING_CHECK"]
      : ["BALANCE_CHECK", "PRICE_INTEGRITY", "RESERVATION_OR_SETTLE"];
  const intelligenceInputs = [];
  const eng = t.decisionSnapshot?.pillars?.engine?.action;
  if (eng) intelligenceInputs.push(`Engine signal: ${eng}`);
  const pre = t.intelligenceTimeline?.preTrade;
  if (Array.isArray(pre?.reasoning) && pre.reasoning.length) {
    intelligenceInputs.push(...pre.reasoning.slice(0, 12).map((x) => String(x)));
  }
  if (t.userThinking) intelligenceInputs.push(`Trader thesis: ${String(t.userThinking).slice(0, 400)}`);
  const dss = t.decisionSnapshot;
  const decisionReasoning = dss?.verdict
    ? `Decision context: ${dss.verdict}${dss.score != null ? ` · score ${dss.score}` : ""}.`
    : "Decision context not attached on this trade row.";
  return {
    ruleTriggers,
    decisionReasoning,
    intelligenceInputs,
    chassis: `${t.symbol} ${t.type} qty=${t.quantity} @ ₹${((t.pricePaise || 0) / 100).toFixed(2)}`,
  };
}


/** Trade schema only allows REAL | CACHE | STALE | FALLBACK — map test/custom providers to REAL. */
const TRADE_PRICE_SOURCES = new Set(["REAL", "CACHE", "STALE", "FALLBACK"]);
const normalizePriceSourceForTrade = (raw) => {
  const v = typeof raw === "string" ? raw.toUpperCase() : "";
  return TRADE_PRICE_SOURCES.has(v) ? v : "REAL";
};

/** Map price.engine tiers → persisted trade / UI contract (REAL | CACHE | STALE | …). */
const mapEnginePriceSourceForTrade = (engineSource) => {
  if (engineSource === "LIVE") return "REAL";
  if (engineSource === "REDIS" || engineSource === "MEMORY") return "CACHE";
  if (engineSource === "STALE") return "STALE";
  return "REAL";
};

const normalizeProductType = (raw) => {
  const v = typeof raw === "string" ? raw.toUpperCase().trim() : "";
  return v === "INTRADAY" ? "INTRADAY" : "DELIVERY";
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
    createdAt: { $lt: cutoff },
  }).session(session);

  // Decrement reservation per stale row and clamp to zero.
  // Uses classic updates for compatibility across Mongoose/Mongo variants.
  for (const trade of staleTrades) {
    const dec = Math.round(Number(trade.totalValuePaise) || 0);
    await User.updateOne(
      { _id: userId },
      { $inc: { reservedBalancePaise: -dec } },
      { session }
    );
    await User.updateOne(
      { _id: userId, reservedBalancePaise: { $lt: 0 } },
      { $set: { reservedBalancePaise: 0 } },
      { session }
    );
    trade.status = "FAILED";
    await trade.save({ session });
  }
};


/** Deterministic hash of the execution HTTP body (includes side). */
const buildExecutionRequestHash = (payload, type) => {
  const symbol = normalizeSymbol(payload.symbol);
  const productType = normalizeProductType(payload.productType);
  const pricePaise = enforcePaise(payload.pricePaise, "pricePaise");
  const quantity = Math.round(Number(payload.quantity));
  const stopLossPaise =
    type === "BUY" && payload.stopLossPaise != null
      ? enforcePaise(payload.stopLossPaise, "stopLossPaise")
      : null;
  const targetPricePaise =
    type === "BUY" && payload.targetPricePaise != null
      ? enforcePaise(payload.targetPricePaise, "targetPricePaise")
      : null;
  const canonical = buildPayloadHash({
    symbol,
    productType,
    pricePaise,
    quantity,
    stopLossPaise,
    targetPricePaise,
  });
  const emotionRaw =
    typeof payload.preTradeEmotion === "string" ? payload.preTradeEmotion.trim().toUpperCase() : "";
  const suffix = emotionRaw ? `|${emotionRaw}` : "";
  return crypto.createHash("sha256").update(`${type}|${canonical}${suffix}`).digest("hex");
};

const buildIdempotentResponseEnvelope = (result) => {
  const t = result.trade;
  const bal = result.updatedBalance;
  return {
    tradeId: t.tradeId,
    executionPricePaise: t.pricePaise,
    totalValuePaise: t.totalValuePaise,
    status: "COMPLETED",
    trade: t,
    updatedBalance: bal,
    executionBalance: bal,
    currentBalance: bal,
  };
};

/** Normalize idempotency envelopes that predate executionBalance/currentBalance split. */
const normalizeIdempotencyEnvelope = (env) => {
  if (!env || typeof env !== "object") return env;
  const exec = env.executionBalance ?? env.updatedBalance;
  const cur = env.currentBalance ?? env.updatedBalance;
  return { ...env, executionBalance: exec, currentBalance: cur, updatedBalance: exec };
};

const toServiceResult = (envelope) => ({
  trade: envelope.trade,
  updatedBalance: envelope.updatedBalance,
  executionBalance: envelope.executionBalance ?? envelope.updatedBalance,
  currentBalance: envelope.currentBalance ?? envelope.updatedBalance,
  ...(envelope.replayApproximateBalance ? { replayApproximateBalance: true } : {}),
});

const finalizeHttpReplay = async (userDoc, replay) => {
  const freshUser = await User.findById(userDoc._id).lean();
  const env = normalizeIdempotencyEnvelope(replay);
  const exec = env.executionBalance ?? env.updatedBalance;
  const cur = freshUser?.balance ?? env.currentBalance;
  return {
    ...toServiceResult({ ...env, updatedBalance: exec, executionBalance: exec, currentBalance: cur }),
    systemStateVersion: freshUser?.systemStateVersion ?? 0,
  };
};

const finalizeTxnReplay = async (session, userId, rawEnvelope) => {
  const env = normalizeIdempotencyEnvelope(rawEnvelope);
  const fresh = await User.findById(userId).select("balance systemStateVersion").session(session).lean();
  const exec = env.executionBalance ?? env.updatedBalance;
  const cur = fresh?.balance ?? env.currentBalance;
  return {
    envelope: { ...env, executionBalance: exec, currentBalance: cur, updatedBalance: exec },
    systemStateVersion: fresh?.systemStateVersion ?? 0,
  };
};

/**
 * Fast replay without starting a transaction (read committed).
 * Lock is scoped by userId + requestId (matches `idx_user_request_uniq`).
 * If the lock document expired (TTL) but the trade remains, replay from Trade using `executionRequestHash`.
 */
const tryReplayCompletedIdempotency = async (userDoc, idempotencyKey, requestHash) => {
  const userId = userDoc._id;
  const lock = await ExecutionLock.findOne({
    userId,
    requestId: idempotencyKey,
    status: "COMPLETED",
  }).lean();
  if (lock?.responseData) {
    if (lock.requestPayloadHash && lock.requestPayloadHash !== requestHash) {
      throw new AppError("PAYLOAD_MISMATCH", 400);
    }
    return normalizeIdempotencyEnvelope(lock.responseData);
  }

  const trade = await Trade.findOne({
    user: userId,
    idempotencyKey,
    status: { $in: ["EXECUTED", "PENDING_EXECUTION", "EXECUTED_PENDING_REFLECTION", "PROCESSING"] },
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!trade?.executionRequestHash || trade.executionRequestHash !== requestHash) {
    return null;
  }
  const user = await User.findById(userId).lean();
  if (!user) return null;
  const execBal =
    trade.postExecutionBalancePaise != null ? trade.postExecutionBalancePaise : user.balance;
  const curBal = user.balance;
  return {
    ...buildIdempotentResponseEnvelope({
      trade: normalizeTrade(trade),
      updatedBalance: execBal,
    }),
    executionBalance: execBal,
    currentBalance: curBal,
    replayApproximateBalance: trade.postExecutionBalancePaise == null,
  };
};

/**
 * VALID → IN_USE within session (Mongo authoritative). Clears Redis cache key.
 */
const claimPreTradeTokenInSession = async (session, token, userId) => {
  if (redisClient && redisClient.status === "ready") {
    try {
      await redisClient.del(`pretrade:${token}`);
    } catch (e) {
      /* non-fatal */
    }
  }
  const tok = await PreTradeToken.findOneAndUpdate(
    {
      token,
      userId,
      expiresAt: { $gt: new Date() },
      $or: [{ state: "VALID" }, { state: { $exists: false } }],
    },
    { $set: { state: "IN_USE" } },
    { new: true, session }
  );
  if (!tok) {
    throw new AppError("INVALID_TOKEN", 400);
  }
  return tok;
};

const redisDelTokenCache = async (token) => {
  if (redisClient && redisClient.status === "ready") {
    try {
      await redisClient.del(`pretrade:${token}`);
    } catch (e) {
      /* ignore */
    }
  }
};

// ==========================================
// DECOUPLED LIFECYCLE (STAGE 3A)
// ==========================================

/**
 * Place order inside an existing session (single price from caller). Token must already be IN_USE.
 */
const placeOrderCoreInSession = async (
  session,
  userDoc,
  payload,
  type,
  pricePaise,
  priceSource,
  record,
  executionRequestHash = null
) => {
  const requestId = payload?.requestId;
  const { symbol: rawSymbol, quantity, reason, userThinking, rawIntent, intent, manualTags, preTradeEmotion } =
    payload;
  const clientPricePaise = enforcePaise(payload.pricePaise, "pricePaise");
  const symbol = normalizeSymbol(rawSymbol);
  const requestedProductType = normalizeProductType(payload.productType);
  const emotionNorm =
    typeof preTradeEmotion === "string" && preTradeEmotion.trim()
      ? preTradeEmotion.trim().toUpperCase()
      : null;

  const currentPayloadHash = buildPayloadHash({
    symbol,
    productType: requestedProductType,
    pricePaise: clientPricePaise,
    quantity,
    stopLossPaise: payload.stopLossPaise || null,
    targetPricePaise: payload.targetPricePaise || null,
  });

  if (record.payloadHash !== currentPayloadHash) throw new AppError("PAYLOAD_MISMATCH", 400);
  if (record.verdict === "WAIT" || record.verdict === "AVOID") {
    throw new AppError("TRADE_BLOCKED_BY_DECISION_ENGINE", 400);
  }

  logger.info({
    action: "PRICE_TRANSPARENCY_AUDIT",
    symbol,
    requestId,
    clientPricePaise,
    executionPricePaise: pricePaise,
    source: priceSource,
  });

  const maxDrift = SYSTEM_CONFIG.trade?.maxClientPriceDriftPct ?? 0.005;
  const denom = Math.max(pricePaise, 1);
  const drift = Math.abs(clientPricePaise - pricePaise) / denom;
  if (drift > maxDrift) {
    throw new AppError("PRICE_STALE", 422, "PRICE_STALE");
  }

  if (!quantity || quantity <= 0) throw new AppError("QUANTITY_MUST_BE_POSITIVE", 400);

  const user = await User.findById(userDoc._id).session(session);
  const totalValuePaise = Math.round(quantity * pricePaise);

      let tradeObj = {
        user: user._id,
        idempotencyKey: requestId,
        ...(executionRequestHash ? { executionRequestHash } : {}),
        symbol,
        type,
        productType: requestedProductType,
        quantity,
        pricePaise,
        totalValuePaise,
        reason,
        userThinking,
        preTradeEmotion: emotionNorm,
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

        // C-01 FIX: null-guard user before any property access
        if (!user) throw new AppError("TERMINAL_FUNDING_SHORTFALL", 400);
        const availableBalanceForBuy = user.balance - (user.reservedBalancePaise || 0);
        if (availableBalanceForBuy < totalValuePaise) {
          throw new AppError("TERMINAL_FUNDING_SHORTFALL", 400);
        }
        if (user.balance < totalValuePaise) {
          throw new AppError("INSUFFICIENT_FUNDS", 400);
        }

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
        // SELL Lifecycle — PnL is NOT computed here (C-02 FIX).
        // PnL is computed exactly once in executeOrderCoreInSession where the
        // holding snapshot is taken inside the same session, preventing divergence
        // caused by a concurrent BUY changing avgPricePaise between place and execute.
        const currentHolding = await Holding.findOne({
          userId: user._id,
          symbol: tradeObj.symbol,
          tradeType: requestedProductType,
        }).session(session);
        if (!currentHolding || currentHolding.quantity < quantity) throw new AppError("INSUFFICIENT_QUANTITY", 400);
        const avgHoldingPricePaise = enforcePaise(currentHolding.avgPricePaise, "holding.avgPricePaise");

        // H-09 FIX: include all terminal BUY statuses so holding/trade sync issues
        // (e.g. after schema migrations or partial failures) do not block valid sells.
        const entryTrade = await Trade.findOne({
          user: user._id,
          symbol,
          type: "BUY",
          productType: requestedProductType,
          status: { $in: ["EXECUTED", "EXECUTED_PENDING_REFLECTION", "COMPLETE"] },
        }).sort({ createdAt: -1 }).session(session);
        if (!entryTrade) throw new AppError("ENTRY_TRADE_NOT_FOUND: No active position found for this symbol.", 404);

        Object.assign(tradeObj, {
          entryTradeId: entryTrade._id,
          productType: entryTrade.productType || requestedProductType,
          // pnlPaise and pnlPct intentionally omitted here — set in executeOrderCoreInSession
          entryPlan: {
             entryPricePaise: avgHoldingPricePaise,
             intent: intent || rawIntent,
             reasoning: reason || userThinking
          }
        });
      }

      attachExecutionDecisionContext(tradeObj, payload, record);

      const [trade] = await Trade.create([tradeObj], { session });

      const finalTrade = trade.toObject();
      if (type === 'SELL') {
        const entry = await Trade.findById(trade.entryTradeId).lean();
        finalTrade.openedAt = entry?.createdAt;
      }

  const result = { trade: normalizeTrade(finalTrade), updatedBalance: user.balance };
  return result;
};

const executeOrderCoreInSession = async (session, tradeId) => {
    const existing = await Trade.findById(tradeId).session(session);
    if (!existing) return null;

    const terminalStatuses =
      existing.type === "SELL"
        ? ["EXECUTED", "EXECUTED_PENDING_REFLECTION"]
        : ["EXECUTED"];
    if (terminalStatuses.includes(existing.status)) {
      const user = await User.findById(existing.user).session(session);
      const plain = typeof existing.toObject === "function" ? existing.toObject() : existing;
      return { trade: normalizeTrade(plain), updatedBalance: user.balance };
    }

    if (existing.status === "PROCESSING") {
      throw new AppError("INVALID_TRADE_STATE", 409);
    }

    if (existing.status !== "PENDING_EXECUTION") {
      return null;
    }

    const executionPricePaise = enforcePaise(existing.pricePaise, "execution_price");
    if (!executionPricePaise || executionPricePaise <= 0) {
      throw new AppError("INVALID_MARKET_DATA_INTERCEPTED", 400);
    }

    const trade = await Trade.findOneAndUpdate(
      { _id: tradeId, status: "PENDING_EXECUTION" },
      { status: "PROCESSING" },
      { new: true, session }
    );
    if (!trade) {
      const again = await Trade.findById(tradeId).session(session);
      if (!again) return null;
      const termAgain =
        again.type === "SELL"
          ? ["EXECUTED", "EXECUTED_PENDING_REFLECTION"]
          : ["EXECUTED"];
      if (termAgain.includes(again.status)) {
        const user = await User.findById(again.user).session(session);
        const plain = typeof again.toObject === "function" ? again.toObject() : again;
        return { trade: normalizeTrade(plain), updatedBalance: user.balance };
      }
      return null;
    }

    const user = await User.findById(trade.user).session(session);

    if (trade.type === "BUY") {
      if ((user.reservedBalancePaise || 0) < trade.totalValuePaise) {
        throw new AppError("TERMINAL_FUNDING_SHORTFALL", 400);
      }
      if (user.balance < trade.totalValuePaise) {
        throw new AppError("TERMINAL_FUNDING_SHORTFALL", 400);
      }
      user.balance -= trade.totalValuePaise;
      user.reservedBalancePaise -= trade.totalValuePaise;
      if (user.reservedBalancePaise < 0) user.reservedBalancePaise = 0; // fallback safety
      
      await Holding.findOneAndUpdate(
        { userId: user._id, symbol: trade.symbol, tradeType: trade.productType || "DELIVERY" },
        [
          {
            $set: {
              userId: { $ifNull: ["$userId", user._id] },
              symbol: { $ifNull: ["$symbol", trade.symbol] },
              tradeType: { $ifNull: ["$tradeType", trade.productType || "DELIVERY"] },
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
        metadata: { user: user._id, related_id: trade._id },
        systemExplain: buildTraceSystemExplain(trade),
      }], { session });

    } else {
      // SELL
      const currentHolding = await Holding.findOne({
        userId: user._id,
        symbol: trade.symbol,
        tradeType: trade.productType || "DELIVERY",
      }).session(session);
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
        metadata: { user: user._id, related_id: trade._id },
        systemExplain: buildTraceSystemExplain(trade),
      }], { session });
    }

    trade.status = trade.type === "SELL" ? "EXECUTED_PENDING_REFLECTION" : "EXECUTED";
    trade.reflectionStatus = trade.type === "SELL" ? "PENDING" : null;
    trade.executionTime = new Date();
    trade.trace.timeline.push({ stage: "EXECUTION_STARTED" }, { stage: "EXECUTION_COMMITTED", metadata: { txId: Date.now() } });
    await trade.save({ session });

    await user.save({ session });

    if (trade.type === "SELL") {
      const traceId = getTraceId();
      const payload = {
        tradeId: trade._id.toString(),
        userId: user._id.toString(),
      };
      if (traceId) payload.traceId = traceId;
      /** Analytics run async via TRADE_CLOSED → queue → persistUserAnalyticsSnapshot (not in this txn). */
      await Outbox.create([{ type: "TRADE_CLOSED", payload, status: "PENDING" }], { session });
    }

    const holdings = await Holding.find({ userId: user._id }).session(session);
    recalculateTotalInvested(user, holdings);
    validateSystemInvariants(user, holdings);
    await user.save({ session });

  const result = { trade: normalizeTrade(trade), updatedBalance: user.balance };
  return result;
};

const executeOrder = async (tradeId) => {
  const result = await runInTransaction(async (session) => executeOrderCoreInSession(session, tradeId));
  if (result?.trade) {
    const bal = result.updatedBalance;
    const envelope = {
      ...buildIdempotentResponseEnvelope(result),
      executionBalance: bal,
      currentBalance: bal,
    };
    await ExecutionLock.updateOne(
      { pendingTradeId: tradeId },
      {
        $set: {
          status: "COMPLETED",
          responseData: envelope,
          pendingTradeId: null,
          updatedAt: new Date(),
        },
      }
    );
  }
  return result;
};

/**
 * Single atomic transaction: idempotency upsert, token IN_USE → CONSUMED, place (+ optional execute), lock COMPLETED.
 */
const runAtomicTradeExecution = async (userDoc, payload, type) => {
  const idempotencyKey = payload?.requestId;
  const token = payload.token || payload.preTradeToken;
  if (!idempotencyKey) throw new AppError("REQUEST_ID_REQUIRED", 400);
  if (!token) throw new AppError("PRE_TRADE_REQUIRED", 400);

  flowLog({
    service: "trade.service",
    step: "TRADE_EXECUTION_START",
    status: "INFO",
    data: { type, idempotencyKeyPrefix: String(idempotencyKey).slice(0, 12) },
  });

  const requestHash = buildExecutionRequestHash(payload, type);
  const replay = await tryReplayCompletedIdempotency(userDoc, idempotencyKey, requestHash);
  if (replay) {
    flowLog({
      service: "trade.service",
      step: "IDEMPOTENCY_REPLAY",
      status: "INFO",
      data: { type },
    });
    return finalizeHttpReplay(userDoc, replay);
  }

  const rawSymbol = payload.symbol;
  const symbol = normalizeSymbol(rawSymbol);
  let enginePrice;
  try {
    enginePrice = await getPrice(symbol);
  } catch (error) {
    throw new AppError("MARKET_DATA_UNAVAILABLE", 503);
  }
  if (enginePrice.source === "STALE") {
    throw new AppError("STALE_PRICE_EXECUTION_BLOCKED", 400, "STALE_PRICE_EXECUTION_BLOCKED");
  }
  const pricePaise = enforcePaise(enginePrice?.pricePaise, "execution_price");
  if (!pricePaise || pricePaise <= 0) throw new AppError("INVALID_MARKET_DATA_INTERCEPTED", 400);
  const priceSource = normalizePriceSourceForTrade(mapEnginePriceSourceForTrade(enginePrice.source));

  const out = await runInTransaction(async (session) => {
    flowLog({
      service: "trade.service",
      step: "TRADE_TXN_ACTIVE",
      status: "INFO",
      data: { type },
    });
    let upsertRes;
    try {
      upsertRes = await ExecutionLock.updateOne(
        { userId: userDoc._id, requestId: idempotencyKey },
        {
          $setOnInsert: {
            idempotencyKey,
            userId: userDoc._id,
            requestId: idempotencyKey,
            requestPayloadHash: requestHash,
            status: "IN_PROGRESS",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true, session }
      );
    } catch (e) {
      // H-04 FIX: Handle duplicate-key errors from BOTH unique indexes:
      // - idx_idempotencyKey_uniq (sparse on idempotencyKey field)
      // - idx_user_request_uniq  (compound userId+requestId — newly unique)
      if (e?.code === 11000) {
        const existingLock = await ExecutionLock.findOne({
          userId: userDoc._id,
          requestId: idempotencyKey,
        }).session(session);
        if (existingLock?.responseData) {
          if (existingLock.requestPayloadHash && existingLock.requestPayloadHash !== requestHash) {
            throw new AppError("PAYLOAD_MISMATCH", 400);
          }
          return await finalizeTxnReplay(session, userDoc._id, existingLock.responseData);
        }
        throw new AppError("EXECUTION_IN_PROGRESS", 409);
      }
      throw e;
    }

    const lock = await ExecutionLock.findOne({
      userId: userDoc._id,
      requestId: idempotencyKey,
    }).session(session);
    if (!lock) throw new AppError("IDEMPOTENCY_LOCK_MISSING", 500);

    if (lock.requestPayloadHash && lock.requestPayloadHash !== requestHash) {
      throw new AppError("PAYLOAD_MISMATCH", 400);
    }
    if (String(lock.userId) !== String(userDoc._id)) {
      throw new AppError("TOKEN_USER_MISMATCH", 403);
    }

    if (lock.status === "COMPLETED" && lock.responseData) {
      return await finalizeTxnReplay(session, userDoc._id, lock.responseData);
    }

    const inserted = upsertRes.upsertedCount === 1;
    if (!inserted) {
      if (lock.status === "COMPLETED" && lock.responseData) {
        return await finalizeTxnReplay(session, userDoc._id, lock.responseData);
      }
      if (lock.status === "IN_PROGRESS" || lock.status === "PENDING") {
        throw new AppError("EXECUTION_IN_PROGRESS", 409);
      }
    }

    await cleanupStaleReservations(userDoc._id, session);
    const record = await claimPreTradeTokenInSession(session, token, userDoc._id);
    if (String(record.userId) !== String(userDoc._id)) {
      throw new AppError("TOKEN_USER_MISMATCH", 403);
    }

    const placeResult = await placeOrderCoreInSession(
      session,
      userDoc,
      payload,
      type,
      pricePaise,
      priceSource,
      record,
      requestHash
    );

    await ExecutionLock.updateOne(
      { userId: userDoc._id, requestId: idempotencyKey },
      {
        $set: {
          pendingTradeId: placeResult.trade.tradeId,
          updatedAt: new Date(),
        },
      },
      { session }
    );

    const allowClosedMarketExecution =
      process.env.ALLOW_CLOSED_MARKET_EXECUTION === "true";
    const marketClosed = !isMarketOpen() && !allowClosedMarketExecution;

    let finalResult = placeResult;
    if (!marketClosed) {
      const executed = await executeOrderCoreInSession(session, placeResult.trade.tradeId);
      if (!executed) throw new AppError("EXECUTION_FAILED", 500);
      finalResult = executed;
    }

    const userAfter = await User.findById(userDoc._id).session(session);
    if (userAfter.balance < 0) {
      throw new AppError("INSUFFICIENT_FUNDS", 400);
    }

    const bal = finalResult.updatedBalance;
    const envelope = marketClosed
      ? {
          ...buildIdempotentResponseEnvelope(finalResult),
          status: "PENDING_EXECUTION",
          trade: { ...finalResult.trade, status: "PENDING_EXECUTION" },
          executionBalance: bal,
          currentBalance: bal,
          queuedForMarketOpen: true,
        }
      : {
          ...buildIdempotentResponseEnvelope(finalResult),
          executionBalance: bal,
          currentBalance: bal,
        };

    await ExecutionLock.updateOne(
      { userId: userDoc._id, requestId: idempotencyKey },
      {
        $set: {
          status: "COMPLETED",
          responseData: envelope,
          pendingTradeId: marketClosed ? placeResult.trade.tradeId : null,
          updatedAt: new Date(),
        },
      },
      { session }
    );

    await Trade.updateOne(
      { _id: finalResult.trade.tradeId },
      { $set: { postExecutionBalancePaise: marketClosed ? null : bal } },
      { session }
    );

    await PreTradeToken.updateOne({ token }, { $set: { state: "CONSUMED" } }, { session });

    const vu = await User.findOneAndUpdate(
      { _id: userDoc._id },
      { $inc: { systemStateVersion: 1 }, $set: { lastTradeActivityAt: new Date() } },
      { new: true, session }
    ).select("systemStateVersion");

    flowLog({
      service: "trade.service",
      step: "TRADE_TXN_SUCCESS",
      status: "INFO",
      data: { type },
    });
    return { envelope, systemStateVersion: vu?.systemStateVersion ?? 0 };
  });

  // M-02 FIX: Outbox depth metric outside the Mongo transaction (no session on count).
  if (type === "SELL") {
    try {
      const pendingThreshold = Number(process.env.OUTBOX_PENDING_CRITICAL_THRESHOLD || 500);
      const pendingCount = await Outbox.countDocuments({ status: "PENDING" });
      if (pendingCount > pendingThreshold) {
        logger.error({
          severity: "CRITICAL",
          action: "OUTBOX_PENDING_BACKPRESSURE",
          pendingCount,
          threshold: pendingThreshold,
        });
      }
    } catch (e) {
      logger.warn({ action: "OUTBOX_PENDING_METRIC_SKIP", message: e?.message || String(e) });
    }
  }

  await redisDelTokenCache(token);
  return { ...toServiceResult(out.envelope), systemStateVersion: out.systemStateVersion ?? 0 };
};

const executeBuyTrade = async (userDoc, payload) => runAtomicTradeExecution(userDoc, payload, "BUY");

const executeSellTrade = async (userDoc, payload) => {
  const _start = Date.now();
  const res = await runAtomicTradeExecution(userDoc, payload, "SELL");
  flowLog({
    service: "trade.service",
    step: "EXECUTE_SELL_TRADE_DONE",
    status: "INFO",
    data: { latencyMs: Date.now() - _start },
  });
  return res;
};

/** Standalone place (tests): own transaction — token VALID→IN_USE→ rolled back on failure. */
const placeOrder = async (userDoc, payload, type = "BUY") => {
  const token = payload.token || payload.preTradeToken;
  if (!token) throw new AppError("PRE_TRADE_REQUIRED", 400);
  const symbol = normalizeSymbol(payload.symbol);
  let enginePrice;
  try {
    enginePrice = await getPrice(symbol);
  } catch (e) {
    throw new AppError("MARKET_DATA_UNAVAILABLE", 503);
  }
  if (enginePrice.source === "STALE") {
    throw new AppError("STALE_PRICE_EXECUTION_BLOCKED", 400, "STALE_PRICE_EXECUTION_BLOCKED");
  }
  const pricePaise = enforcePaise(enginePrice?.pricePaise, "execution_price");
  const priceSource = normalizePriceSourceForTrade(mapEnginePriceSourceForTrade(enginePrice.source));
  return runInTransaction(async (session) => {
    await cleanupStaleReservations(userDoc._id, session);
    const record = await claimPreTradeTokenInSession(session, token, userDoc._id);
    const pr = await placeOrderCoreInSession(session, userDoc, payload, type, pricePaise, priceSource, record, null);
    await PreTradeToken.updateOne({ token }, { $set: { state: "CONSUMED" } }, { session });
    return pr;
  });
};

module.exports = { executeBuyTrade, executeSellTrade, placeOrder, executeOrder };
module.exports.__testables = { validatePlanOrThrow, buildExecutionRequestHash };
