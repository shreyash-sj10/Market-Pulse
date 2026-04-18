const Trade = require("../models/trade.model");
const logger = require("../utils/logger");
const { adaptProfile } = require("../adapters/profile.adapter");
const { normalizeTrade } = require("../domain/trade.contract");
const { mapToClosedTrades } = require("../domain/closedTrade.mapper");

const getMe = (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      email: req.user.email,
    },
  });
};

const getProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [totalTrades, sellTrades, winTrades, tradesChrono] = await Promise.all([
      Trade.countDocuments({ user: userId }),
      Trade.countDocuments({ user: userId, type: "SELL" }),
      Trade.countDocuments({ user: userId, type: "SELL", pnlPaise: { $gt: 0 } }),
      /** Ascending FIFO needs full context — last-N-desc would often be orphan SELLs only. */
      Trade.find({ user: userId }).sort({ createdAt: 1 }).limit(400).lean(),
    ]);

    const winRate = sellTrades === 0 ? 0 : Number(((winTrades / sellTrades) * 100).toFixed(2));

    const normalized = tradesChrono.map((t) => normalizeTrade(t));
    let closed = [];
    try {
      closed = mapToClosedTrades(normalized);
    } catch (e) {
      logger.warn({
        action: "PROFILE_CLOSED_MAP_FALLBACK",
        userId: String(userId),
        message: e?.message || String(e),
      });
    }
    const recentLearning = closed.slice(-5);

    res.status(200).json({
      success: true,
      data: adaptProfile(req.user, { totalTrades, winRate }, recentLearning),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  getProfile
};
