const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const calculateMistakeAnalysis = require("./mistakeAnalysis.service");
const { generateExplanation, parseTradeIntent, generateFinalTradeCall } = require("./aiExplanation.service");
const { validateSystemInvariants } = require("../utils/invariants");
const Decimal = require("decimal.js");
const mongoose = require("mongoose");
const Trace = require("../models/trace.model");
const { toSafeKey } = require("../utils/safeUtils");
const { runInTransaction } = require("../utils/transaction");
const { validateStrategy } = require("./strategy.engine");
const { analyzeReview } = require("./review.engine");
const { calculateMissedOpportunity } = require("./missedOpportunity.service");
const { calculateDecisionScore = () => 0 } = require("./scoring.engine");
const marketDataService = require("./marketData.service");
const timelineService = require("./intelligence/timeline.service");

/**
 * Normalizes symbol for consistency (NSE: .NS, BSE: .BO)
 */
const normalizeSymbol = (symbol) => {
  if (!symbol) return symbol;
  const s = symbol.toUpperCase().trim();
  if (s.endsWith('.NS') || s.endsWith('.BO')) return s;
  return `${s}.NS`; 
};

/**
 * CONVERSION HELPERS
 */
const toPaise = (rupee) => Math.round((rupee || 0) * 100);
const fromPaise = (paise) => (paise || 0) / 100;

const recalculateTotalInvested = (user) => {
  let totalPaise = 0;
  user.holdings.forEach((data) => {
    totalPaise += Math.round(data.quantity * data.avgCost);
  });
  user.totalInvested = totalPaise;
};

const executeBuyTrade = async (userDoc, payload) => {
  return await runInTransaction(async (session) => {
    const { 
      symbol: rawSymbol, quantity, price, stopLoss, targetPrice, 
      reason, userThinking, rawIntent, intent, manualTags, rrRatio,
      intelligenceTimeline: preTrade 
    } = payload;
    const symbol = normalizeSymbol(rawSymbol);

    const validation = await marketDataService.validateSymbol(symbol);
    if (!validation.isValid || !price || price <= 0) {
      throw new AppError("INVALID_MARKET_DATA_INTERCEPTED", 400);
    }

    if (!quantity || quantity <= 0) {
      throw new AppError("QUANTITY_MUST_BE_POSITIVE", 400);
    }

    const pricePaise = Math.round(price);
    const totalValuePaise = quantity * pricePaise;
    const user = await User.findById(userDoc._id).session(session);

    if (!user || user.balance < totalValuePaise) {
      throw new AppError("TERMINAL_FUNDING_SHORTFALL", 400);
    }

    user.balance -= totalValuePaise;
    const currentHolding = user.holdings.get(toSafeKey(symbol)) || { quantity: 0, avgCost: 0, stopLoss: null };
    const newQuantity = currentHolding.quantity + quantity;
    const newAvgCostPaise = Math.round((currentHolding.quantity * currentHolding.avgCost + quantity * pricePaise) / newQuantity);

    user.holdings.set(toSafeKey(symbol), {
      quantity: newQuantity,
      avgCost: newAvgCostPaise,
      stopLoss: stopLoss ? Math.round(stopLoss) : currentHolding.stopLoss
    });

    recalculateTotalInvested(user);
    validateSystemInvariants(user);

    const analysis = calculateMistakeAnalysis({
      tradeValue: totalValuePaise,
      balanceBeforeTrade: user.balance + totalValuePaise,
      stopLoss: stopLoss ? Math.round(stopLoss) : null,
      targetPrice: targetPrice ? Math.round(targetPrice) : null,
      entryPrice: pricePaise,
      tradesLast24h: 0, 
      lastTradePnL: 0,
      lastTradeTime: null
    });

    // 🧠 AI INTELLIGENCE LAYER: INTENT & VERDICT
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
      symbol,
      type: "BUY",
      quantity,
      pricePaise: pricePaise,
      totalValuePaise: totalValuePaise,
      stopLoss: stopLoss ? Math.round(stopLoss) : null,
      targetPrice: targetPrice ? Math.round(targetPrice) : null,
      reason,
      userThinking,
      rawIntent: rawIntent || intent,
      intent,
      manualTags: manualTags || [],
      rrRatio: rrRatio || null,
      parsedIntent,
      finalTradeCall: finalTradeCallAndVerdict,
      analysis: {
        ...analysis,
        explanation: aiExplanation.explanation,
        humanBehavior: aiExplanation.behaviorAnalysis,
      },
      intelligenceTimeline: { 
        preTrade: preTrade || null,
        trace: ["Order authorized for Market Entry.", `AI Intelligence Decision: ${finalTradeCallAndVerdict.suggestedAction}`]
      }
    }], { session });

    await Trace.create([{
      type: "TRADE",
      stages: { constraint_engine: { rejected: 0, rules_applied: ["BALANCE_CHECK"], violations: [] } },
      metadata: { user: user._id, related_id: trade._id }
    }], { session });

    await user.save({ session });
    return { trade, updatedBalance: user.balance };
  });
};

const executeSellTrade = async (userDoc, payload) => {
  return await runInTransaction(async (session) => {
    const { symbol: rawSymbol, quantity, price, reason, userThinking, rawIntent } = payload;
    const symbol = normalizeSymbol(rawSymbol);

    const validation = await marketDataService.validateSymbol(symbol);
    if (!validation.isValid || !price || price <= 0) {
      throw new AppError("INVALID_MARKET_DATA_INTERCEPTED", 400);
    }

    const user = await User.findById(userDoc._id).session(session);
    const currentHolding = user.holdings.get(toSafeKey(symbol));

    if (!currentHolding || currentHolding.quantity < quantity) {
      throw new AppError("INSUFFICIENT_QUANTITY", 400);
    }

    const pricePaise = Math.round(price);
    const totalValuePaise = quantity * pricePaise;
    const costBasisPaise = Math.round(quantity * currentHolding.avgCost);
    const tradePnLPaise = totalValuePaise - costBasisPaise;

    user.balance += totalValuePaise;
    user.realizedPnL = (user.realizedPnL || 0) + tradePnLPaise;

    const remainingQty = currentHolding.quantity - quantity;
    if (remainingQty <= 0) {
      user.holdings.delete(toSafeKey(symbol));
    } else {
      user.holdings.set(toSafeKey(symbol), {
        quantity: remainingQty,
        avgCost: currentHolding.avgCost,
        stopLoss: currentHolding.stopLoss
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

    // Retrieve original entry execution for comparative analysis
    const entryTrade = await Trade.findOne({ user: user._id, symbol, type: "BUY" })
      .sort({ createdAt: -1 });

    const [trade] = await Trade.create([{
      user: user._id,
      symbol,
      type: "SELL",
      quantity,
      pricePaise: pricePaise,
      totalValuePaise: totalValuePaise,
      reason,
      userThinking,
      rawIntent,
      analysis,
      pnl: tradePnLPaise,
      pnlPercentage: costBasisPaise > 0 ? Number(((tradePnLPaise / costBasisPaise) * 100).toFixed(2)) : 0,
      // Record original plan for "Plan vs Reality" analysis
      stopLoss: entryTrade?.stopLoss || null,
      targetPrice: entryTrade?.targetPrice || null,
      rrRatio: entryTrade?.rrRatio || null,
    }], { session });

    // 🧠 RUN REFLECTION ENGINE (Comparative Mode)
    const review = analyzeReview(trade, entryTrade);
    trade.learningOutcome = {
       verdict: review.verdict,
       type: review.reflection.type,
       context: review.reflection.context,
       insight: review.reflection.insight,
       improvementSuggestion: review.reflection.improvementSuggestion
    };

    const fullPostTradeParams = await timelineService.integratePostTrade(trade, { price: pricePaise });
    trade.intelligenceTimeline = {
       ...trade.intelligenceTimeline,
       ...fullPostTradeParams
    };
    await trade.save({ session });

    await Trace.create([{
      type: "TRADE",
      stages: { constraint_engine: { rejected: 0, rules_applied: ["HOLDING_CHECK"], violations: [] } },
      metadata: { user: user._id, related_id: trade._id }
    }], { session });

    await user.save({ session });
    return { trade, updatedBalance: user.balance };
  });
};

module.exports = { executeBuyTrade, executeSellTrade };
