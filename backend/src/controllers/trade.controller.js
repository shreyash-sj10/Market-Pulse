const Trade = require("../models/trade.model");
const tradeService = require("../services/trade.service");
const { formatTrade, formatTradeList } = require("../utils/responseFormatter");
const logger = require("../utils/logger");

// ================= BUY TRADE =================
/**
 * POST /trades/buy
 * Executes a BUY order for the authenticated user.
 * Validates balance atomically, persists trade, attaches AI explanation.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const buyTrade = async (req, res, next) => {
  try {
    const { trade, updatedBalance } = await tradeService.executeBuyTrade(req.user, req.body);
    
    const formattedTrade = formatTrade(trade);
    if (formattedTrade.analysis && trade.explanation) {
      formattedTrade.analysis.explanation = trade.explanation;
    }

    res.status(201).json({
      success: true,
      trade: formattedTrade,
      balance: updatedBalance,
    });
  } catch (error) {
    logger.error(`BUY trade failed for user ${req.user?._id}: ${error.message}`);
    next(error);
  }
};

// ================= SELL TRADE =================
/**
 * POST /trades/sell
 * Executes a SELL order validating existing holdings.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const sellTrade = async (req, res, next) => {
  try {
    const { trade, updatedBalance } = await tradeService.executeSellTrade(req.user, req.body);
    
    const formattedTrade = formatTrade(trade);
    if (formattedTrade.analysis && trade.explanation) {
      formattedTrade.analysis.explanation = trade.explanation;
    }

    res.status(201).json({
      success: true,
      trade: formattedTrade,
      balance: updatedBalance,
    });
  } catch (error) {
    logger.error(`SELL trade failed for user ${req.user?._id}: ${error.message}`);
    next(error);
  }
};

// ================= TRADE HISTORY =================
/**
 * GET /trades
 * Returns paginated trade history for the authenticated user.
 * Supports ?page=N&limit=N query params (default: page=1, limit=20).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const getTradeHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const totalTrades = await Trade.countDocuments({ user: req.user._id });

    const trades = await Trade.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: trades.length,
      total: totalTrades,
      page,
      totalPages: Math.ceil(totalTrades / limit),
      nextCursor: page < Math.ceil(totalTrades / limit) ? page + 1 : null,
      trades: formatTradeList(trades),
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
