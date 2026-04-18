const Trade = require("../models/trade.model");
const tradeService = require("../services/trade.service");
const { normalizeTrade } = require("../domain/trade.contract");
const logger = require("../utils/logger");

const { adaptTrade } = require("../adapters/trade.adapter");

// ================= BUY TRADE =================
/**
 * POST /trades/buy
 */
const buyTrade = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const clientRequestId = req.headers["idempotency-key"];
    const { trade, updatedBalance } = await tradeService.executeBuyTrade(req.user, {
      ...req.body,
      requestId: clientRequestId,
      token: req.headers["pre-trade-token"] || req.body.preTradeToken,
      traceRequestId: req.requestId
    });

    logger.info({
      action: "BUY",
      userId: req.user._id,
      requestId: req.requestId,
      symbol: trade.symbol,
      status: "SUCCESS",
      latency: Date.now() - startTime
    });

    res.status(201).json({
      success: true,
      data: adaptTrade(trade),
      state: "COMPLETE"
    });
  } catch (error) {
    logger.error({
      action: "BUY",
      userId: req.user?._id,
      requestId: req.requestId,
      status: "FAIL",
      message: error.message,
      latency: Date.now() - startTime
    });
    next(error);
  }
};

// ================= SELL TRADE =================
/**
 * POST /trades/sell
 */
const sellTrade = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const clientRequestId = req.headers["idempotency-key"];
    const { trade, updatedBalance } = await tradeService.executeSellTrade(req.user, {
      ...req.body,
      requestId: clientRequestId,
      token: req.headers["pre-trade-token"] || req.body.preTradeToken,
      traceRequestId: req.requestId
    });

    logger.info({
      action: "SELL",
      userId: req.user._id,
      requestId: req.requestId,
      symbol: trade.symbol,
      status: "SUCCESS",
      latency: Date.now() - startTime
    });

    res.status(201).json({
      success: true,
      data: adaptTrade(trade),
      state: "COMPLETE"
    });
  } catch (error) {
    logger.error({
      action: "SELL",
      userId: req.user?._id,
      requestId: req.requestId,
      status: "FAIL",
      message: error.message,
      latency: Date.now() - startTime
    });
    next(error);
  }
};

// ================= TRADE HISTORY =================
const getTradeHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const totalTrades = await Trade.countDocuments({ user: req.user._id });

    const trades = await Trade.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: trades.map((trade) => adaptTrade(normalizeTrade(trade))),
      state: trades.length === 0 ? "EMPTY" : "ACTIVE"
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  buyTrade,
  sellTrade,
  getTradeHistory,
};
