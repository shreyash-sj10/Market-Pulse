const Trade = require("../models/trade.model");
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

    const [totalTrades, sellTrades, winTrades, recentTrades] = await Promise.all([
      Trade.countDocuments({ user: userId }),
      Trade.countDocuments({ user: userId, type: "SELL" }),
      Trade.countDocuments({ user: userId, type: "SELL", pnlPaise: { $gt: 0 } }),
      Trade.find({ user: userId }).sort({ createdAt: -1 }).limit(5)
    ]);

    const winRate = sellTrades === 0 ? 0 : Number(((winTrades / sellTrades) * 100).toFixed(2));
    
    // Convert recent trades to journal-compatible cards
    const normalized = recentTrades.map(t => normalizeTrade(t));
    const closed = mapToClosedTrades(normalized);
    // Note: closed might be empty if last 5 trades aren't closed.
    // However, the rule says render stored learning.
    // For now, we take whatever closed trades are available from recent history.

    res.status(200).json({
      success: true,
      data: adaptProfile(req.user, { totalTrades, winRate }, closed)
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  getProfile
};
