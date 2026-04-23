const mongoose = require("mongoose");
const Trade = require("../models/trade.model");
const Outbox = require("../models/outbox.model");
const tradeService = require("../services/trade.service");
const { normalizeTrade } = require("../domain/trade.contract");
const logger = require("../utils/logger");
const { sendSuccess } = require("../utils/response.helper");

const { adaptTrade } = require("../adapters/trade.adapter");

const deriveTradeLifecycleState = (trade) => {
  if (!trade || typeof trade !== "object") return "ACTIVE";
  if (trade.status === "FAILED" || trade.reflectionStatus === "FAILED") return "FAILED";
  if (trade.status === "PENDING_EXECUTION") return "PENDING";
  if (trade.status === "EXECUTED_PENDING_REFLECTION" || trade.reflectionStatus === "PENDING") {
    return "PROCESSING";
  }
  if (trade.status === "COMPLETE" || trade.status === "EXECUTED") return "COMPLETE";
  return "ACTIVE";
};

// ================= BUY TRADE =================
/**
 * POST /trades/buy
 */
const buyTrade = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const clientRequestId = req.headers["idempotency-key"];
    const {
      trade,
      updatedBalance,
      executionBalance,
      currentBalance,
      systemStateVersion,
      replayApproximateBalance,
    } = await tradeService.executeBuyTrade(req.user, {
      ...req.body,
      requestId: clientRequestId,
      token: req.headers["pre-trade-token"] || req.body.preTradeToken,
      traceRequestId: req.traceId || req.requestId,
    });

    logger.info({
      action: "BUY",
      userId: req.user._id,
      traceId: req.traceId || req.requestId,
      requestId: req.requestId,
      symbol: trade.symbol,
      status: "SUCCESS",
      latency: Date.now() - startTime,
    });

    sendSuccess(res, req, {
      success: true,
      data: {
        ...adaptTrade(trade),
        updatedBalance,
        executionBalance,
        currentBalance,
      },
      state: deriveTradeLifecycleState(trade),
      meta: {
        systemStateVersion,
        ...(replayApproximateBalance ? { replayApproximateBalance: true } : {}),
      },
    }, 201);
  } catch (error) {
    logger.error({
      action: "BUY",
      userId: req.user?._id,
      traceId: req.traceId || req.requestId,
      requestId: req.requestId,
      status: "FAIL",
      message: error.message,
      latency: Date.now() - startTime,
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
    const {
      trade,
      updatedBalance,
      executionBalance,
      currentBalance,
      systemStateVersion,
      replayApproximateBalance,
    } = await tradeService.executeSellTrade(req.user, {
      ...req.body,
      requestId: clientRequestId,
      token: req.headers["pre-trade-token"] || req.body.preTradeToken,
      traceRequestId: req.traceId || req.requestId,
    });

    logger.info({
      action: "SELL",
      userId: req.user._id,
      traceId: req.traceId || req.requestId,
      requestId: req.requestId,
      symbol: trade.symbol,
      status: "SUCCESS",
      latency: Date.now() - startTime,
    });

    sendSuccess(res, req, {
      success: true,
      data: {
        ...adaptTrade(trade),
        updatedBalance,
        executionBalance,
        currentBalance,
      },
      state: deriveTradeLifecycleState(trade),
      meta: {
        systemStateVersion,
        ...(replayApproximateBalance ? { replayApproximateBalance: true } : {}),
      },
    }, 201);
  } catch (error) {
    logger.error({
      action: "SELL",
      userId: req.user?._id,
      traceId: req.traceId || req.requestId,
      requestId: req.requestId,
      status: "FAIL",
      message: error.message,
      latency: Date.now() - startTime,
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

    const pages = limit > 0 ? Math.ceil(totalTrades / limit) : 0;
    sendSuccess(res, req, {
      success: true,
      data: trades.map((trade) => adaptTrade(normalizeTrade(trade))),
      state: trades.length === 0 ? "EMPTY" : "ACTIVE",
      meta: {
        total: totalTrades,
        page,
        limit,
        pages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /trades/execution-status/:tradeId — async reflection / outbox visibility (additive).
 */
const getTradeAsyncStatus = async (req, res, next) => {
  try {
    const { tradeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tradeId)) {
      return sendSuccess(res, req, {
        success: false,
        message: "INVALID_TRADE_ID",
        meta: { traceId: req.traceId || req.requestId },
      }, 400);
    }

    const trade = await Trade.findOne({ _id: tradeId, user: req.user._id })
      .select("status reflectionStatus reflectionJobAttempts updatedAt executionTime")
      .lean();

    if (!trade) {
      return sendSuccess(res, req, {
        success: false,
        message: "NOT_FOUND",
        meta: { traceId: req.traceId || req.requestId },
      }, 404);
    }

    const outboxJobs = await Outbox.find({
      "payload.tradeId": tradeId,
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("status attempts maxAttempts lastError updatedAt type processingStartedAt")
      .lean();

    let executionDerivedStatus = "COMPLETED";
    if (trade.status === "PENDING_EXECUTION") executionDerivedStatus = "PENDING";
    if (trade.reflectionStatus === "PENDING") executionDerivedStatus = "PENDING";
    if (trade.reflectionStatus === "FAILED") executionDerivedStatus = "FAILED";
    if (outboxJobs.some((j) => j.status === "PENDING" || j.status === "PROCESSING")) {
      executionDerivedStatus = "PROCESSING";
    }
    if (outboxJobs.some((j) => j.status === "FAILED")) {
      executionDerivedStatus = "FAILED";
    }

    sendSuccess(res, req, {
      success: true,
      data: {
        tradeId,
        tradeStatus: trade.status,
        reflectionStatus: trade.reflectionStatus,
        executionDerivedStatus,
        outboxJobs: outboxJobs.map((j) => ({
          id: String(j._id),
          type: j.type,
          status: j.status,
          attempts: j.attempts,
          maxAttempts: j.maxAttempts,
          lastError: j.lastError,
          updatedAt: j.updatedAt,
          processingStartedAt: j.processingStartedAt,
        })),
      },
      meta: {
        traceId: req.traceId || req.requestId,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  buyTrade,
  sellTrade,
  getTradeHistory,
  getTradeAsyncStatus,
};
