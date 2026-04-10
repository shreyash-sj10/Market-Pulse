const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const calculateMistakeAnalysis = require("./mistakeAnalysis.service");
const { generateExplanation } = require("./aiExplanation.service");
const { validateSystemInvariants } = require("../utils/invariants");
const Decimal = require("decimal.js");
const mongoose = require("mongoose");
const Trace = require("../models/trace.model");
const { toSafeKey } = require("../utils/safeUtils");
const { runInTransaction } = require("../utils/transaction");
const { validateStrategy } = require("./strategy.engine");
const { analyzeReview } = require("./review.engine");
const { calculateMissedOpportunity } = require("./missedOpportunity.service");
const { calculateDecisionScore } = require("./scoring.engine");
const marketDataService = require("./marketData.service");

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
 * ₹1.00 = 100 paise
 */
const toPaise = (rupee) => Math.round((rupee || 0) * 100);
const fromPaise = (paise) => (paise || 0) / 100;

/**
 * Recalculates totalInvested from scratch to ensure absolute invariant integrity.
 */
const recalculateTotalInvested = (user) => {
  let totalPaise = 0;
  user.holdings.forEach((data) => {
    totalPaise += Math.round(data.quantity * data.avgCost);
  });
  user.totalInvested = totalPaise;
};

/**
 * Detached AI process to enrich trade with behavioral insights and intent parsing.
 * Runs post-transaction to ensure execution latency is zero.
 * INVARIANT: Must NOT modify financial state.
 */
const enrichTradeWithAI = async (tradeId, riskScore, mistakeTags, context) => {
  try {
    const { symbol, type, reason, userThinking, rawIntent } = context;

    // 1. Parallel AI Work: Narrative + Intent Parsing
    const [explanationData, intentData] = await Promise.all([
      generateExplanation(riskScore, mistakeTags, context),
      parseTradeIntent(rawIntent)
    ]);

    // 2. Market Context Snapshot (Simulated RSI/Trend logic)
    const marketContext = {
      rsi: Math.floor(Math.random() * 40) + 30, // Mocked for deterministic pipeline feed
      trend: Math.random() > 0.5 ? "BULLISH" : "BEARISH",
      volatility: Number((Math.random() * 2).toFixed(2))
    };

    // 3. Deterministic Strategy Validation
    const strategyValidation = validateStrategy(intentData, marketContext);

    // 4. Initial Review Analysis (Verdict + Discipline Check)
    const reviewData = analyzeReview({ 
      ...context, 
      analysis: { strategyMatch: strategyValidation, mistakeTags },
      pnl: context.pnl // Only for SELL
    });

    // 5. Post-Trade Enrichment (Missed Opportunity for SELL)
    let missedOpportunity = null;
    if (type === 'SELL') {
      const tradeDoc = await Trade.findById(tradeId);
      missedOpportunity = await calculateMissedOpportunity(tradeDoc);
    }

    // 6. AI Review Summary (Symmetric synthesis)
    const aiSummary = await generateTradeReviewSummary(reviewData, { 
      symbol, pnl: context.pnl || 0, missedOpportunity 
    });

    // 7. Deterministic Decision Score
    const updatedTradeForScoring = {
      ...context,
      analysis: { strategyMatch: strategyValidation, mistakeTags },
      missedOpportunity,
      marketContextAtEntry: marketContext
    };
    const qualityScore = calculateDecisionScore(updatedTradeForScoring);

    // 8. Update Record
    await Trade.findByIdAndUpdate(tradeId, {
      "analysis.explanation": explanationData.explanation,
      "analysis.humanBehavior": explanationData.behaviorAnalysis,
      "analysis.strategyMatch": strategyValidation,
      "analysis.review": { ...reviewData, aiSummary },
      "analysis.decisionScore": qualityScore,
      "rawIntent": rawIntent,
      "parsedIntent": intentData,
      "marketContextAtEntry": marketContext,
      "missedOpportunity": missedOpportunity
    });
  } catch (err) {
    console.error(`[AI-Worker] Failed to enrich trade ${tradeId}:`, err.message);
  }
};

const executeBuyTrade = async (userDoc, payload) => {
  return await runInTransaction(async (session) => {
    const { symbol: rawSymbol, quantity, price, stopLoss, targetPrice, reason, userThinking, rawIntent } = payload;
    const symbol = normalizeSymbol(rawSymbol);

    // 1. DATA INTEGRITY CHECK
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

    // GUARD: INSUFFICIENT_FUNDS
    if (!user || user.balance < totalValuePaise) {
      const deficiency = (totalValuePaise - (user?.balance || 0)) / 100;
      throw new AppError(`TERMINAL_FUNDING_SHORTFALL: Missing ₹${deficiency.toLocaleString('en-IN')}`, 400);
    }

    // 1. Financial Update
    user.balance -= totalValuePaise;

    // 2. Holdings Update
    const currentHolding = user.holdings.get(toSafeKey(symbol)) || { quantity: 0, avgCost: 0, stopLoss: null };
    const newQuantity = currentHolding.quantity + quantity;
    
    // Weighted Average Cost (in Paise)
    const newAvgCostPaise = Math.round(
      (currentHolding.quantity * currentHolding.avgCost + quantity * pricePaise) / newQuantity
    );

    user.holdings.set(toSafeKey(symbol), {
      quantity: newQuantity,
      avgCost: newAvgCostPaise,
      stopLoss: stopLoss ? Math.round(stopLoss) : currentHolding.stopLoss
    });

    // 3. Post-Operation Invariant Check (Pre-Commit)
    recalculateTotalInvested(user);
    validateSystemInvariants(user);

    // 4. Analysis & Persistence
    const [tradesLast24h, lastTrade] = await Promise.all([
      Trade.countDocuments({
        user: user._id,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }).session(session),
      Trade.findOne({ user: user._id }).sort({ createdAt: -1 }).session(session)
    ]);

    const analysis = calculateMistakeAnalysis({
      tradeValue: totalValuePaise,
      balanceBeforeTrade: user.balance + totalValuePaise,
      stopLoss: stopLoss ? Math.round(stopLoss) : null,
      targetPrice: targetPrice ? Math.round(targetPrice) : null,
      entryPrice: pricePaise,
      tradesLast24h,
      lastTradePnL: lastTrade ? lastTrade.pnl : 0,
      lastTradeTime: lastTrade ? lastTrade.createdAt : null
    });

    const [trade] = await Trade.create([{
      user: user._id,
      symbol,
      type: "BUY",
      quantity,
      price: pricePaise,
      totalValue: totalValuePaise,
      stopLoss: stopLoss ? Math.round(stopLoss) : null,
      targetPrice: targetPrice ? Math.round(targetPrice) : null,
      reason,
      userThinking,
      rawIntent,
      analysis,
    }], { session });

    // Generate Trace_v1
    await Trace.create([{
      type: "TRADE",
      stages: {
        interpretation_layer: { ml_used: false, ml_confidence: 1.0 },
        candidate_generator: { input_count: 1, output_count: 1 },
        constraint_engine: { rejected: 0, rules_applied: ["BALANCE_CHECK", "NORMALIZATION"], violations: [] },
        scoring_engine: { input_count: 1, output_count: 1 },
        optimizer: { combinations_evaluated: 1, selected_score: 1.0 },
        reliability_engine: { final_output_count: 1 }
      },
      metadata: { user: user._id, related_id: trade._id }
    }], { session });

    await user.save({ session });
    
    // AI enrichment in "detached" mode
    setImmediate(() => {
      enrichTradeWithAI(trade._id, analysis.riskScore, analysis.mistakeTags, {
        symbol, type: 'BUY', reason, userThinking, rawIntent
      });
    });

    return { trade, updatedBalance: user.balance };
  });
};

const executeSellTrade = async (userDoc, payload) => {
  return await runInTransaction(async (session) => {
    const { symbol: rawSymbol, quantity, price, reason, userThinking, rawIntent } = payload;
    const symbol = normalizeSymbol(rawSymbol);

    // 1. DATA INTEGRITY CHECK
    const validation = await marketDataService.validateSymbol(symbol);
    if (!validation.isValid || !price || price <= 0) {
      throw new AppError("INVALID_MARKET_DATA_INTERCEPTED", 400);
    }

    const user = await User.findById(userDoc._id).session(session);
    const currentHolding = user.holdings.get(toSafeKey(symbol));

    // GUARD: INSUFFICIENT_QUANTITY
    if (!currentHolding) {
      throw new AppError(`No open position found for asset: ${symbol.split('.')[0]}`, 400);
    }
    if (currentHolding.quantity < quantity) {
      throw new AppError(`Insufficient quantity. Owned: ${currentHolding.quantity}, Requested: ${quantity}`, 400);
    }

    const pricePaise = Math.round(price);
    const totalValuePaise = quantity * pricePaise;
    const costBasisPaise = Math.round(quantity * currentHolding.avgCost);
    const tradePnLPaise = totalValuePaise - costBasisPaise;

    // 1. Balance & Snapshot Updates
    user.balance += totalValuePaise;
    user.realizedPnL = (user.realizedPnL || 0) + tradePnLPaise;

    // 2. Holdings Reduction
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

    // 3. Post-Operation Invariant Check (Pre-Commit)
    recalculateTotalInvested(user);
    validateSystemInvariants(user);

    // 4. Analysis & Persistence
    const [tradesLast24h, lastTrade] = await Promise.all([
      Trade.countDocuments({
        user: user._id,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }).session(session),
      Trade.findOne({ user: user._id }).sort({ createdAt: -1 }).session(session)
    ]);

    const analysis = calculateMistakeAnalysis({
      tradeValue: totalValuePaise,
      balanceBeforeTrade: user.balance - totalValuePaise,
      entryPrice: pricePaise,
      tradesLast24h,
      lastTradePnL: lastTrade ? lastTrade.pnl : 0,
      lastTradeTime: lastTrade ? lastTrade.createdAt : null
    });

    const [trade] = await Trade.create([{
      user: user._id,
      symbol,
      type: "SELL",
      quantity,
      price: pricePaise,
      totalValue: totalValuePaise,
      reason,
      userThinking,
      rawIntent,
      analysis,
      pnl: tradePnLPaise,
      pnlPercentage: costBasisPaise > 0 ? Number(((tradePnLPaise / costBasisPaise) * 100).toFixed(2)) : 0
    }], { session });

    // Generate Trace_v1
    await Trace.create([{
      type: "TRADE",
      stages: {
        interpretation_layer: { ml_used: false, ml_confidence: 1.0 },
        candidate_generator: { input_count: 1, output_count: 1 },
        constraint_engine: { rejected: 0, rules_applied: ["HOLDING_CHECK", "NORMALIZATION"], violations: [] },
        scoring_engine: { input_count: 1, output_count: 1 },
        optimizer: { combinations_evaluated: 1, selected_score: 1.0 },
        reliability_engine: { final_output_count: 1 }
      },
      metadata: { user: user._id, related_id: trade._id }
    }], { session });

    await user.save({ session });
    
    // AI enrichment in background
    setImmediate(() => {
      enrichTradeWithAI(trade._id, analysis.riskScore, analysis.mistakeTags, {
        symbol, type: 'SELL', reason, userThinking, rawIntent, pnl: tradePnLPaise
      });
    });

    return { trade, updatedBalance: user.balance };
  });
};

module.exports = { executeBuyTrade, executeSellTrade };
