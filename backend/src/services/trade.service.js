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
 * Recalculates totalInvested from scratch to ensure absolute invariant integrity.
 */
const recalculateTotalInvested = (user) => {
  let total = new Decimal(0);
  user.holdings.forEach((data) => {
    total = total.add(new Decimal(data.quantity).mul(data.avgCost));
  });
  user.totalInvested = total.toNumber();
};

/**
 * Detached AI process to enrich trade with behavioral insights.
 * Runs post-transaction to ensure execution latency is zero.
 * INVARIANT: Must NOT modify financial state.
 */
const enrichTradeWithAI = async (tradeId, riskScore, mistakeTags, context) => {
  try {
    const { explanation, behaviorAnalysis } = await generateExplanation(
      riskScore,
      mistakeTags,
      context
    );
    // Explicitly using findByIdAndUpdate on Trade model ONLY
    await Trade.findByIdAndUpdate(tradeId, {
      "analysis.explanation": explanation,
      "analysis.humanBehavior": behaviorAnalysis,
    });
  } catch (err) {
    console.error(`[AI-Worker] Failed to enrich trade ${tradeId}:`, err.message);
  }
};

/**
 * Execute a BUY order with transactional integrity and Invariant Enforcement.
 */
const executeBuyTrade = async (userDoc, payload) => {
  const { symbol: rawSymbol, quantity, price, stopLoss, targetPrice, reason, userThinking } = payload;
  const symbol = normalizeSymbol(rawSymbol);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!symbol || !quantity || !price) {
      throw new AppError("Symbol, quantity, and price are required", 400);
    }

    const totalValue = new Decimal(quantity).mul(price).toNumber();
    const user = await User.findById(userDoc._id).session(session);

    // GUARD: INSUFFICIENT_FUNDS
    if (!user || user.balance < totalValue) {
      throw new AppError("INSUFFICIENT_FUNDS", 400);
    }

    // 1. Financial Update
    user.balance = new Decimal(user.balance).sub(totalValue).toNumber();

    // 2. Holdings Update
    const currentHolding = user.holdings.get(toSafeKey(symbol)) || { quantity: 0, avgCost: 0, stopLoss: null };
    const newQuantity = currentHolding.quantity + quantity;
    const newAvgCost = new Decimal(currentHolding.quantity)
      .mul(currentHolding.avgCost)
      .add(new Decimal(quantity).mul(price))
      .div(newQuantity)
      .toNumber();

    user.holdings.set(toSafeKey(symbol), {
      quantity: newQuantity,
      avgCost: newAvgCost,
      stopLoss: stopLoss || currentHolding.stopLoss
    });

    // 3. Post-Operation Invariant Check (Pre-Commit)
    recalculateTotalInvested(user);
    validateSystemInvariants(user);

    // 4. Analysis & Persistence
    const tradesLast24h = await Trade.countDocuments({
      user: user._id,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).session(session);

    const analysis = calculateMistakeAnalysis({
      tradeValue: totalValue,
      balanceBeforeTrade: user.balance + totalValue,
      stopLoss,
      targetPrice,
      entryPrice: price,
      tradesLast24h,
    });

    const [trade] = await Trade.create([{
      user: user._id,
      symbol,
      type: "BUY",
      quantity,
      price,
      totalValue,
      stopLoss,
      targetPrice,
      reason,
      userThinking,
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
    await session.commitTransaction();

    enrichTradeWithAI(trade._id, analysis.riskScore, analysis.mistakeTags, {
      symbol, type: 'BUY', reason, userThinking
    });

    return { trade, updatedBalance: user.balance };
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * Execute a SELL order with transactional integrity and Realized P&L capture.
 */
const executeSellTrade = async (userDoc, payload) => {
  const { symbol: rawSymbol, quantity, price, reason, userThinking } = payload;
  const symbol = normalizeSymbol(rawSymbol);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!symbol || !quantity || !price) {
      throw new AppError("Symbol, quantity and price are required", 400);
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

    const totalValue = new Decimal(quantity).mul(price).toNumber();
    const costBasis = new Decimal(quantity).mul(currentHolding.avgCost).toNumber();
    const tradePnL = new Decimal(totalValue).sub(costBasis).toNumber();

    // 1. Balance & Snapshot Updates
    user.balance = new Decimal(user.balance).add(totalValue).toNumber();
    user.realizedPnL = new Decimal(user.realizedPnL || 0).add(tradePnL).toNumber();

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
    const tradesLast24h = await Trade.countDocuments({
      user: user._id,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).session(session);

    const analysis = calculateMistakeAnalysis({
      tradeValue: totalValue,
      balanceBeforeTrade: user.balance - totalValue,
      entryPrice: price,
      tradesLast24h,
    });

    const [trade] = await Trade.create([{
      user: user._id,
      symbol,
      type: "SELL",
      quantity,
      price,
      totalValue,
      reason,
      userThinking,
      analysis,
      pnl: tradePnL,
      pnlPercentage: costBasis > 0 ? new Decimal(tradePnL).div(costBasis).mul(100).toNumber() : 0
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
    await session.commitTransaction();

    enrichTradeWithAI(trade._id, analysis.riskScore, analysis.mistakeTags, {
      symbol, type: 'SELL', reason, userThinking
    });

    return { trade, updatedBalance: user.balance };
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = { executeBuyTrade, executeSellTrade };
