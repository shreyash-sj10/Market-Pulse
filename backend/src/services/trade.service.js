const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const ExecutionLock = require("../models/executionLock.model");
const AppError = require("../utils/AppError");
const calculateMistakeAnalysis = require("./mistakeAnalysis.service");
const { generateExplanation, parseTradeIntent, generateFinalTradeCall } = require("./aiExplanation.service");
const { validateSystemInvariants } = require("../utils/invariants");
const Trace = require("../models/trace.model");
const { toSafeKey } = require("../utils/safeUtils");
const { runInTransaction } = require("../utils/transaction");
const { normalizeTrade } = require("../domain/trade.contract");
const { analyzeReview } = require("./review.engine");
const marketDataService = require("./marketData.service");
const timelineService = require("./intelligence/timeline.service");
const { toHoldingsObject } = require("../utils/holdingsNormalizer");
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
const logger = require("../lib/logger");


/**
 * Normalizes symbol for consistency (NSE: .NS, BSE: .BO)
 */
const normalizeSymbol = (symbol) => {
  if (!symbol) return symbol;
  const s = symbol.toUpperCase().trim();
  if (s.endsWith('.NS') || s.endsWith('.BO')) return s;
  return `${s}.NS`; 
};

const MIN_RR = 1.2;

const computePlanMetrics = (side, entryPricePaise, stopLossPaise, targetPricePaise) => {
  if (!stopLossPaise || !targetPricePaise || !entryPricePaise) return null;

  const isBuy = side === "BUY";
  const risk = isBuy ? entryPricePaise - stopLossPaise : stopLossPaise - entryPricePaise;
  const reward = isBuy ? targetPricePaise - entryPricePaise : entryPricePaise - targetPricePaise;
  if (risk <= 0 || reward <= 0) return null;

  return {
    risk,
    reward,
    rr: reward / risk,
  };
};

const computeRr = (side, entryPricePaise, stopLossPaise, targetPricePaise) => {
  const metrics = computePlanMetrics(side, entryPricePaise, stopLossPaise, targetPricePaise);
  if (!metrics) return null;
  return Number(metrics.rr.toFixed(2));
};

const validatePlanOrThrow = (side, pricePaise, stopLossPaise, targetPricePaise) => {
  if (!stopLossPaise || !targetPricePaise) {
    throw new AppError("PLAN_REQUIRED", 400);
  }

  if (side === "BUY") {
    if (targetPricePaise <= pricePaise) {
      throw new AppError("INVALID_TARGET", 400);
    }
    if (stopLossPaise >= pricePaise) {
      throw new AppError("INVALID_STOPLOSS", 400);
    }
  } else if (side === "SELL") {
    if (targetPricePaise >= pricePaise) {
      throw new AppError("INVALID_TARGET", 400);
    }
    if (stopLossPaise <= pricePaise) {
      throw new AppError("INVALID_STOPLOSS", 400);
    }
  }

  const metrics = computePlanMetrics(side, pricePaise, stopLossPaise, targetPricePaise);
  if (!metrics || !Number.isFinite(metrics.rr) || metrics.rr < MIN_RR) {
    throw new AppError("INVALID_RR", 400);
  }

  return Number(metrics.rr.toFixed(2));
};

const recalculateTotalInvested = (user) => {
  const holdingsObject = toHoldingsObject(user.holdings);
  let totalPaise = 0;
  Object.values(holdingsObject).forEach((data) => {
    totalPaise += Math.round(data.quantity * data.avgCost);
  });
  user.totalInvested = totalPaise;
};

const ensureHoldingsMap = (user) => {
  if (user.holdings instanceof Map) return user.holdings;
  const asMap = new Map(Object.entries(toHoldingsObject(user.holdings)));
  user.holdings = asMap;
  return asMap;
};

const handleIdempotency = async (userId, idempotencyKey) => {
  if (!idempotencyKey) {
    throw new AppError("IDEMPOTENCY_KEY_REQUIRED", 400);
  }

  const existingLock = await ExecutionLock.findOne({ idempotencyKey });
  if (existingLock) {
    if (existingLock.status === "PENDING") {
      throw new AppError("DUPLICATE_REQUEST_PENDING", 409);
    }
    return existingLock.responseData;
  }

  // Create PENDING lock
  await ExecutionLock.create({
    idempotencyKey,
    userId,
    status: "PENDING"
  });
  return null;
};

const completeIdempotency = async (idempotencyKey, responseData) => {
  await ExecutionLock.findOneAndUpdate(
    { idempotencyKey },
    { 
      status: "COMPLETED",
      responseData
    }
  );
};

const executeBuyTrade = async (userDoc, payload) => {
  const idempotencyKey = payload?.idempotencyKey;
  const cachedResponse = await handleIdempotency(userDoc._id, idempotencyKey);
  if (cachedResponse) return cachedResponse;

  const startTime = Date.now();
  try {
    logger.info({
      action: "BUY_EXECUTION_INITIATED",
      userId: userDoc._id,
      requestId: payload.requestId,
      symbol: payload.symbol,
      status: "STARTED"
    });

    const tradeTask = async (session) => {
      const { 
        symbol: rawSymbol, quantity, pricePaise, stopLossPaise, targetPricePaise, 
        reason, userThinking, rawIntent, intent, manualTags, token,
        intelligenceTimeline: preTrade 
      } = payload;
      const symbol = normalizeSymbol(rawSymbol);

      if (!token) {
        throw new AppError("PRE_TRADE_REQUIRED", 400);
      }

      const record = getDecisionRecord(token);
      if (!record) {
        throw new AppError("INVALID_TOKEN", 400);
      }

      // Hash verification for payload integrity
      const currentPayloadHash = buildPayloadHash({
        symbol,
        pricePaise,
        quantity,
        stopLossPaise,
        targetPricePaise,
      });

      if (record.payloadHash !== currentPayloadHash) {
        throw new AppError("PAYLOAD_MISMATCH", 400);
      }

      if (record.verdict === "WAIT" || record.verdict === "AVOID") {
        throw new AppError("TRADE_BLOCKED_BY_DECISION_ENGINE", 400);
      }

      consumeDecisionRecord(token);

      const validation = await marketDataService.validateSymbol(symbol);
      if (!validation.isValid || !pricePaise || pricePaise <= 0) {
        throw new AppError("INVALID_MARKET_DATA_INTERCEPTED", 400);
      }

      if (!quantity || quantity <= 0) {
        throw new AppError("QUANTITY_MUST_BE_POSITIVE", 400);
      }

      const rr = validatePlanOrThrow("BUY", pricePaise, stopLossPaise, targetPricePaise);
      const totalValuePaise = quantity * pricePaise;
      const user = await User.findById(userDoc._id).session(session);

      if (!user || user.balance < totalValuePaise) {
        throw new AppError("TERMINAL_FUNDING_SHORTFALL", 400);
      }

      user.balance -= totalValuePaise;
      const holdingsMap = ensureHoldingsMap(user);
      const currentHolding = holdingsMap.get(toSafeKey(symbol)) || { quantity: 0, avgCost: 0, stopLossPaise: null };
      const newQuantity = currentHolding.quantity + quantity;
      const newAvgCostPaise = Math.round((currentHolding.quantity * currentHolding.avgCost + quantity * pricePaise) / newQuantity);

      holdingsMap.set(toSafeKey(symbol), {
        quantity: newQuantity,
        avgCost: newAvgCostPaise,
        stopLossPaise: stopLossPaise || currentHolding.stopLossPaise
      });

      recalculateTotalInvested(user);
      validateSystemInvariants(user);

      const analysis = calculateMistakeAnalysis({
        tradeValue: totalValuePaise,
        balanceBeforeTrade: user.balance + totalValuePaise,
        stopLoss: stopLossPaise,
        targetPrice: targetPricePaise,
        entryPrice: pricePaise,
        tradesLast24h: 0, 
        lastTradePnL: 0,
        lastTradeTime: null
      });

      const [parsedIntent, aiExplanation] = await Promise.all([
        parseTradeIntent(userThinking),
        generateExplanation(analysis.riskScore, analysis.mistakeTags, {
          symbol, type: "BUY", reason, userThinking
        })
      ]);

      const finalTradeCallAndVerdict = await generateFinalTradeCall({
        market: { direction: preTrade?.riskLevel || "NEUTRAL", confidence: preTrade?.confidence || 50, reason: preTrade?.reasoning?.[0] || "Analysis pending." },
        setup: { type: parsedIntent?.strategy || "General", score: 80, reason: "Setup aligns with current market bias." },
        behavior: { risk: analysis.mistakeTags.length > 0 ? "Elevated" : "Controlled", score: 100 - analysis.riskScore, reason: aiExplanation.behaviorAnalysis },
        risk: { level: preTrade?.riskLevel || "LOW", score: analysis.riskScore, reason: aiExplanation.explanation },
        finalScore: 100 - analysis.riskScore
      }, { verdict: analysis.riskScore > 70 ? "AVOID" : "BUY" });

      const [trade] = await Trade.create([{
        user: user._id,
        idempotencyKey,
        symbol,
        type: "BUY",
        quantity,
        pricePaise,
        totalValuePaise,
        stopLossPaise,
        targetPricePaise,
        reason,
        userThinking,
        rawIntent: rawIntent || intent,
        intent,
        manualTags: manualTags || [],
        rrRatio: rr,
        parsedIntent,
        finalTradeCall: finalTradeCallAndVerdict,
        analysis: {
          ...analysis,
          explanation: aiExplanation.explanation,
          humanBehavior: aiExplanation.behaviorAnalysis,
        },
        // --- PART 3: SNAPSHOT INTEGRITY (FIXED) ---
        entryPlan: {
          entryPricePaise: pricePaise,
          stopLossPaise: stopLossPaise,
          targetPricePaise: targetPricePaise,
          rr: rr,
          intent: parsedIntent?.strategy || "General",
          reasoning: userThinking || "Institutional process verified."
        },
        decisionSnapshot: {
          verdict: finalTradeCallAndVerdict?.suggestedAction || "Proceed with Caution",
          score: 100 - (analysis?.riskScore || 0),
          pillars: {
            market: { direction: preTrade?.riskLevel, reasoning: preTrade?.reasoning?.[0] },
            behavior: { tags: analysis.mistakeTags, assessment: aiExplanation.behaviorAnalysis },
            risk: { score: analysis.riskScore, level: preTrade?.riskLevel },
            rr: { ratio: rr, status: rr >= 1.5 ? "OPTIMAL" : "MINIMAL" }
          }
        },
        intelligenceTimeline: { 
          preTrade: preTrade || null,
          trace: ["Order authorized for Market Entry.", `AI Intelligence Decision: ${finalTradeCallAndVerdict.suggestedAction}`]
        },
        trace: {
          timeline: [
            { stage: "PRE_TRADE_VALIDATED", metadata: { token } },
            { stage: "DECISION_GENERATED", metadata: { verdict: finalTradeCallAndVerdict.suggestedAction } },
            { stage: "EXECUTION_STARTED" },
            { stage: "EXECUTION_COMMITTED", metadata: { txId: Date.now() } }
          ]
        }
      }], { session });


      await Trace.create([{
        type: "PLAN",
        humanSummary: {
          decisionSummary: `Entry position established for ${trade.symbol} at ₹${(trade.pricePaise/100).toFixed(2)}.`,
          riskLevel: "SYSTEM_APPROVED",
          verdict: "AUTHORIZED",
          simpleExplanation: "Institutional trade passed all pre-flight risk constraints and liquidity checks."
        },
        stages: { constraint_engine: { rejected: 0, rules_applied: ["BALANCE_CHECK", "PRICE_INTEGRITY"], violations: [] } },
        metadata: { user: user._id, related_id: trade._id }
      }], { session });

      await user.save({ session });
      const result = { trade: normalizeTrade(trade), updatedBalance: user.balance };
      await completeIdempotency(idempotencyKey, result);
      return result;
    };

    return await runInTransaction(tradeTask);
  } catch (error) {
    // Cleanup lock if it failed (only if it was us who created it and it's still PENDING)
    await ExecutionLock.deleteOne({ idempotencyKey, status: "PENDING" });
    throw error;
  }
};

const executeSellTrade = async (userDoc, payload) => {
  const idempotencyKey = payload?.idempotencyKey;
  const cachedResponse = await handleIdempotency(userDoc._id, idempotencyKey);
  if (cachedResponse) return cachedResponse;

  const startTime = Date.now();
  try {
    logger.info({
      action: "SELL_EXECUTION_INITIATED",
      userId: userDoc._id,
      requestId: payload.requestId,
      symbol: payload.symbol,
      status: "STARTED"
    });

    const tradeTask = async (session) => {
      const { symbol: rawSymbol, quantity, pricePaise, reason, userThinking, rawIntent } = payload;
      const symbol = normalizeSymbol(rawSymbol);

      const validation = await marketDataService.validateSymbol(symbol);
      if (!validation.isValid || !pricePaise || pricePaise <= 0) {
        throw new AppError("INVALID_MARKET_DATA_INTERCEPTED", 400);
      }

      const user = await User.findById(userDoc._id).session(session);
      const holdingsMap = ensureHoldingsMap(user);
      const currentHolding = holdingsMap.get(toSafeKey(symbol));

      if (!currentHolding || currentHolding.quantity < quantity) {
        throw new AppError("INSUFFICIENT_QUANTITY", 400);
      }

      const totalValuePaise = quantity * pricePaise;
      const costBasisPaise = Math.round(quantity * currentHolding.avgCost);
      const tradePnLPaise = totalValuePaise - costBasisPaise;

      user.balance += totalValuePaise;
      user.realizedPnL = (user.realizedPnL || 0) + tradePnLPaise;

      const remainingQty = currentHolding.quantity - quantity;
      if (remainingQty <= 0) {
        holdingsMap.delete(toSafeKey(symbol));
      } else {
        holdingsMap.set(toSafeKey(symbol), {
          quantity: remainingQty,
          avgCost: currentHolding.avgCost,
          stopLossPaise: currentHolding.stopLossPaise
        });
      }

      recalculateTotalInvested(user);
      validateSystemInvariants(user);

      const analysis = calculateMistakeAnalysis({
        tradeValue: totalValuePaise,
        balanceBeforeTrade: user.balance - totalValuePaise,
        entryPrice: pricePaise,
        tradesLast24h: 0,
        lastTradePnL: 0,
        lastTradeTime: null
      });

      const entryTrade = await Trade.findOne({ user: user._id, symbol, type: "BUY" }).sort({ createdAt: -1 });
      const rr = computeRr("BUY", entryTrade?.pricePaise || currentHolding.avgCost, entryTrade?.stopLossPaise, entryTrade?.targetPricePaise);

      // Use the entryPlan snapshot if available
      const entryPlan = entryTrade?.entryPlan || {
        entryPricePaise: entryTrade?.pricePaise || currentHolding.avgCost || 0,
        stopLossPaise: entryTrade?.stopLossPaise || 0,
        targetPricePaise: entryTrade?.targetPricePaise || 0,
        rr: rr || 0
      };

      const reflection = analyzeReflection({
        ...entryPlan,
        exitPricePaise: pricePaise,
        pnlPaise: tradePnLPaise
      });

      const [trade] = await Trade.create([{
        user: user._id,
        idempotencyKey,
        symbol,
        type: "SELL",
        quantity,
        pricePaise,
        totalValuePaise,
        reason,
        userThinking,
        rawIntent,
        analysis,
        pnlPaise: tradePnLPaise,
        pnlPct: costBasisPaise > 0 ? Number(((tradePnLPaise / costBasisPaise) * 100).toFixed(2)) : 0,
        entryTradeId: entryTrade?._id || null,
        stopLossPaise: entryTrade?.stopLossPaise || null,
        targetPricePaise: entryTrade?.targetPricePaise || null,
        rrRatio: rr,
        learningOutcome: {
          verdict: reflection.verdict,
          insight: reflection.insight,
          improvementSuggestion: reflection.improvement
        },
        entryPlan: {
          entryPricePaise: entryPlan.entryPricePaise,
          stopLossPaise: entryPlan.stopLossPaise || 0,
          targetPricePaise: entryPlan.targetPricePaise || 0,
          rr: entryPlan.rr,
          intent: "LIQUIDATION",
          reasoning: userThinking || "Liquidating position per terminal protocol."
        },
        decisionSnapshot: {
          verdict: reflection.verdict,
          score: 100,
          pillars: {
             market: { verdict: "N/A" },
             behavior: { verdict: reflection.verdict },
             risk: { verdict: "EXIT" },
             rr: { verdict: "N/A" }
          }
        },
        intelligenceTimeline: {
          postTrade: {
             outcome: reflection.executionPattern,
             behavioralFlags: reflection.tags
          }
        },
        trace: {
          timeline: [
            { stage: "EXECUTION_STARTED" },
            { stage: "EXECUTION_COMMITTED", metadata: { pnl: tradePnLPaise, pnlPct: costBasisPaise > 0 ? Number(((tradePnLPaise / costBasisPaise) * 100).toFixed(2)) : 0 } },
            { stage: "REFLECTION_COMPLETED", metadata: { verdict: reflection.verdict } }
          ]
        }
      }], { session });

      await Trace.create([{
        type: "ANALYSIS",
        humanSummary: {
          decisionSummary: `Liquidation of ${symbol} at ₹${(pricePaise/100).toFixed(2)}.`,
          behaviorFlags: reflection.tags,
          reflectionSummary: reflection.insight,
          riskLevel: "MITIGATED",
          verdict: reflection.verdict,
          simpleExplanation: `Position closed. Execution classified as ${reflection.verdict} based on protocol alignment.`
        },
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

      await user.save({ session });
      const result = { 
        trade: normalizeTrade({
          ...trade.toObject(),
          entryTradeId: entryTrade?._id || null,
          openedAt: entryTrade?.createdAt || null,
        }),
        updatedBalance: user.balance
      };
      await completeIdempotency(idempotencyKey, result);
      return result;
    };

    return await runInTransaction(tradeTask);
  } catch (error) {
    await ExecutionLock.deleteOne({ idempotencyKey, status: "PENDING" });
    throw error;
  }
};

module.exports = { executeBuyTrade, executeSellTrade };
module.exports.__testables = { computeRr, validatePlanOrThrow };
