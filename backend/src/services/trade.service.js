const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const Holding = require("../models/holding.model");
const ExecutionLock = require("../models/executionLock.model");
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


/**
 * Normalizes symbol for consistency (NSE: .NS, BSE: .BO)
 */
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

  try {
    await ExecutionLock.create({
      requestId,
      userId,
      status: "PENDING"
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("DUPLICATE_EXECUTION_BLOCKED", 409);
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

const executeBuyTrade = async (userDoc, payload) => {
  const rrAcceptableThreshold = SYSTEM_CONFIG.intelligence.preTrade.lowRrThreshold;
  const avoidRiskScore = SYSTEM_CONFIG.trade.executionAvoidRiskScore;
  const requestId = payload?.requestId;
  await handleIdempotency(userDoc._id, requestId);

  // ── Fetch REAL behavioral inputs BEFORE opening the session ──────────────
  // These queries read committed data; they must not sit inside the session
  // transaction to avoid stale-read or session-contention issues.
  const now = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [tradesLast24h, lastTrade] = await Promise.all([
    Trade.countDocuments({ user: userDoc._id, createdAt: { $gte: cutoff24h } }),
    Trade.findOne({ user: userDoc._id }).sort({ createdAt: -1 }).lean(),
  ]);
  const lastTradePnL = lastTrade?.pnlPaise ?? null;
  const lastTradeTime = lastTrade?.createdAt ?? null;

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

      const record = await getDecisionRecord(token);
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

      await consumeDecisionRecord(token);

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
      await Holding.findOneAndUpdate(
        { userId: user._id, symbol },
        [
          {
            $set: {
              userId: { $ifNull: ["$userId", user._id] },
              symbol: { $ifNull: ["$symbol", symbol] },
              quantity: { $add: [{ $ifNull: ["$quantity", 0] }, quantity] },
              avgPricePaise: {
                $let: {
                  vars: {
                    oldQty: { $ifNull: ["$quantity", 0] },
                    oldAvg: { $ifNull: ["$avgPricePaise", 0] },
                    buyQty: quantity,
                    buyPrice: pricePaise,
                  },
                  in: {
                    $round: [
                      {
                        $divide: [
                          {
                            $add: [
                              { $multiply: ["$$oldQty", "$$oldAvg"] },
                              { $multiply: ["$$buyQty", "$$buyPrice"] },
                            ],
                          },
                          { $add: ["$$oldQty", "$$buyQty"] },
                        ],
                      },
                      0,
                    ],
                  },
                },
              },
              updatedAt: "$$NOW",
            },
          },
        ],
        {
          upsert: true,
          updatePipeline: true,
          session,
        }
      );

      const holdings = await Holding.find({ userId: user._id }).session(session);
      recalculateTotalInvested(user, holdings);
      validateSystemInvariants(user, holdings);

      const analysis = calculateMistakeAnalysis({
        tradeValue: totalValuePaise,
        balanceBeforeTrade: user.balance + totalValuePaise,
        stopLossPaise,
        targetPricePaise,
        entryPricePaise: pricePaise,
        tradesLast24h,    // real count from DB — enables OVERTRADING detection
        lastTradePnL,     // real PnL from last trade — enables REVENGE_TRADING detection
        lastTradeTime,    // real timestamp — enables time-window checks
      });

      const [parsedIntent, aiExplanation] = await Promise.all([
        parseTradeIntent(userThinking),
        generateExplanation(analysis.riskScore, analysis.mistakeTags, {
          symbol, type: "BUY", reason, userThinking
        })
      ]);
      const parsedIntentValid = isValidStatus(parsedIntent);
      const aiExplanationValid = isValidStatus(aiExplanation);

      const finalTradeCallAndVerdict = await generateFinalTradeCall({
        market: {
          direction: preTrade?.riskLevel ?? "UNAVAILABLE",
          confidence: preTrade?.confidence ?? null,
          reason: preTrade?.reasoning?.[0] ?? preTrade?.reason ?? "INSUFFICIENT_MARKET_DATA",
        },
        setup: {
          type: parsedIntentValid ? parsedIntent.strategy : "UNAVAILABLE",
          score: parsedIntentValid ? (parsedIntent.confidence ?? null) : null,
          reason: parsedIntentValid ? "Setup aligns with current market bias." : parsedIntent?.reason || "INSUFFICIENT_INTENT_DATA",
        },
        behavior: {
          risk: analysis.mistakeTags.length > 0 ? "Elevated" : "Controlled",
          score: 100 - analysis.riskScore,
          reason: aiExplanationValid ? aiExplanation.behaviorAnalysis : aiExplanation?.reason || "AI_UNAVAILABLE",
        },
        risk: {
          level: preTrade?.riskLevel || "LOW",
          score: analysis.riskScore,
          reason: aiExplanationValid ? aiExplanation.explanation : aiExplanation?.reason || "AI_UNAVAILABLE",
        },
        finalScore: 100 - analysis.riskScore
      }, { verdict: analysis.riskScore > avoidRiskScore ? "AVOID" : "BUY" });

      const [trade] = await Trade.create([{
        user: user._id,
        idempotencyKey: requestId,
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
        rr,
        parsedIntent,
        finalTradeCall: finalTradeCallAndVerdict,
        analysis: {
          ...analysis,
          explanation: aiExplanationValid ? aiExplanation.explanation : null,
          humanBehavior: aiExplanationValid ? aiExplanation.behaviorAnalysis : null,
          intelligenceStatus: aiExplanation?.status || "UNAVAILABLE",
          intelligenceReason: aiExplanationValid ? null : (aiExplanation?.reason || "AI_UNAVAILABLE"),
        },
        // --- PART 3: SNAPSHOT INTEGRITY (FIXED) ---
        entryPlan: {
          entryPricePaise: pricePaise,
          stopLossPaise: stopLossPaise,
          targetPricePaise: targetPricePaise,
          rr: rr,
          intent: parsedIntentValid ? parsedIntent.strategy : "UNAVAILABLE",
          reasoning: userThinking || "Institutional process verified."
        },
        decisionSnapshot: {
          verdict: finalTradeCallAndVerdict?.suggestedAction || finalTradeCallAndVerdict?.status || "UNAVAILABLE",
          score: 100 - (analysis?.riskScore || 0),
          pillars: {
            market: { direction: preTrade?.riskLevel, reasoning: preTrade?.reasoning?.[0] },
            behavior: { tags: analysis.mistakeTags, assessment: aiExplanationValid ? aiExplanation.behaviorAnalysis : null },
            risk: { score: analysis.riskScore, level: preTrade?.riskLevel },
            rr: { ratio: rr, status: rr >= rrAcceptableThreshold ? "OPTIMAL" : "MINIMAL" }
          }
        },
        intelligenceTimeline: { 
          preTrade: preTrade || null,
          trace: [
            "Order authorized for Market Entry.",
            `AI Intelligence Decision: ${finalTradeCallAndVerdict?.suggestedAction || finalTradeCallAndVerdict?.reason || "UNAVAILABLE"}`,
          ]
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
      await completeIdempotency(requestId, result);
      return result;
    };

    return await runInTransaction(tradeTask);
  } catch (error) {
    // Cleanup lock if it failed (only if it was us who created it and it's still PENDING)
    await ExecutionLock.deleteOne({ requestId, status: "PENDING" });
    throw error;
  }
};

const executeSellTrade = async (userDoc, payload) => {
  const requestId = payload?.requestId;
  await handleIdempotency(userDoc._id, requestId);

  // ── Fetch REAL behavioral inputs BEFORE opening the session ──────────────
  const now = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [tradesLast24h, lastTrade] = await Promise.all([
    Trade.countDocuments({ user: userDoc._id, createdAt: { $gte: cutoff24h } }),
    Trade.findOne({ user: userDoc._id }).sort({ createdAt: -1 }).lean(),
  ]);
  const lastTradePnL = lastTrade?.pnlPaise ?? null;
  const lastTradeTime = lastTrade?.createdAt ?? null;

  try {
    logger.info({
      action: "SELL_EXECUTION_INITIATED",
      userId: userDoc._id,
      requestId: payload.requestId,
      symbol: payload.symbol,
      status: "STARTED"
    });

    const tradeTask = async (session) => {
      const { symbol: rawSymbol, quantity, pricePaise, reason, userThinking, rawIntent, token } = payload;
      const symbol = normalizeSymbol(rawSymbol);

      if (!token) {
        throw new AppError("PRE_TRADE_REQUIRED", 400);
      }

      const record = await getDecisionRecord(token);
      if (!record) {
        throw new AppError("INVALID_TOKEN", 400);
      }

      const currentPayloadHash = buildPayloadHash({
        symbol,
        pricePaise,
        quantity,
        stopLossPaise: null,
        targetPricePaise: null,
      });

      if (record.payloadHash !== currentPayloadHash) {
        throw new AppError("PAYLOAD_MISMATCH", 400);
      }

      await consumeDecisionRecord(token);

      const validation = await marketDataService.validateSymbol(symbol);
      if (!validation.isValid || !pricePaise || pricePaise <= 0) {
        throw new AppError("INVALID_MARKET_DATA_INTERCEPTED", 400);
      }

      const user = await User.findById(userDoc._id).session(session);
      const currentHolding = await Holding.findOne({ userId: user._id, symbol }).session(session);

      if (!currentHolding) {
        throw new AppError("POSITION_NOT_FOUND", 400);
      }

      if (currentHolding.quantity < quantity) {
        throw new AppError("INSUFFICIENT_QUANTITY", 400);
      }

      const totalValuePaise = quantity * pricePaise;
      const costBasisPaise = Math.round(quantity * currentHolding.avgPricePaise);
      const tradePnLPaise = totalValuePaise - costBasisPaise;

      user.balance += totalValuePaise;
      user.realizedPnL = (user.realizedPnL || 0) + tradePnLPaise;

      const remainingQty = currentHolding.quantity - quantity;
      if (remainingQty <= 0) {
        await Holding.deleteOne({ _id: currentHolding._id }).session(session);
      } else {
        currentHolding.quantity = remainingQty;
        currentHolding.updatedAt = new Date();
        await currentHolding.save({ session });
      }

      const holdings = await Holding.find({ userId: user._id }).session(session);
      recalculateTotalInvested(user, holdings);
      validateSystemInvariants(user, holdings);

      const analysis = calculateMistakeAnalysis({
        tradeValue: totalValuePaise,
        balanceBeforeTrade: user.balance - totalValuePaise,
        entryPricePaise: pricePaise,
        tradesLast24h,    // real count from DB — enables OVERTRADING detection
        lastTradePnL,     // real PnL from last trade — enables REVENGE_TRADING detection
        lastTradeTime,    // real timestamp — enables time-window checks
      });

      const entryTrade = await Trade.findOne({ user: user._id, symbol, type: "BUY" })
        .sort({ createdAt: -1 })
        .session(session);
      if (!entryTrade) {
        throw new AppError("ENTRY_TRADE_NOT_FOUND", 400);
      }

      const rr = entryTrade.rr ?? entryTrade.entryPlan?.rr ?? null;

      // Use the entryPlan snapshot if available
      const entryPlan = entryTrade.entryPlan || {
        entryPricePaise: entryTrade.pricePaise || currentHolding.avgPricePaise || 0,
        stopLossPaise: entryTrade.stopLossPaise || 0,
        targetPricePaise: entryTrade.targetPricePaise || 0,
        rr: rr || 0
      };

      const reflection = analyzeReflection({
        ...entryPlan,
        exitPricePaise: pricePaise,
        pnlPaise: tradePnLPaise
      });

      const [trade] = await Trade.create([{
        user: user._id,
        idempotencyKey: requestId,
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
        pnlPct: computePnlPct(tradePnLPaise, costBasisPaise),
        entryTradeId: entryTrade._id,
        stopLossPaise: entryTrade.stopLossPaise || null,
        targetPricePaise: entryTrade.targetPricePaise || null,
        rr,
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
          // Score derived from exit engine's deviation analysis: lower deviation = higher quality.
          // Falls back to the behavior risk score if exit engine score is unavailable.
          score: typeof reflection.deviationScore === "number"
            ? Math.max(0, 100 - reflection.deviationScore)
            : (typeof analysis?.riskScore === "number" ? Math.max(0, 100 - analysis.riskScore) : null),
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
            { stage: "EXECUTION_COMMITTED", metadata: { pnl: tradePnLPaise, pnlPct: computePnlPct(tradePnLPaise, costBasisPaise) } },
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
          entryTradeId: entryTrade._id,
          openedAt: entryTrade.createdAt || null,
        }),
        updatedBalance: user.balance
      };
      await completeIdempotency(requestId, result);
      return result;
    };

    return await runInTransaction(tradeTask);
  } catch (error) {
    await ExecutionLock.deleteOne({ requestId, status: "PENDING" });
    throw error;
  }
};

module.exports = { executeBuyTrade, executeSellTrade };
module.exports.__testables = { validatePlanOrThrow };
