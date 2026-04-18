const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const { runInTransaction } = require("../utils/transaction");
const logger = require("../utils/logger");

const SWEEP_INTERVAL_MS = 30 * 1000;
const PENDING_EXPIRY_MS = Number(process.env.PENDING_ORDER_EXPIRY_MS || 24 * 60 * 60 * 1000);
const SWEEP_BATCH_LIMIT = 300;

const isExpiredPendingOrder = (trade, nowMs) => {
  const createdAtMs = new Date(trade.createdAt || 0).getTime();
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return true;
  return nowMs - createdAtMs > PENDING_EXPIRY_MS;
};

const isInvalidPendingOrder = (trade) => {
  if (!trade?.user) return true;
  if (!trade?.symbol || typeof trade.symbol !== "string") return true;
  if (trade.type !== "BUY" && trade.type !== "SELL") return true;
  if (!Number.isInteger(trade.quantity) || trade.quantity <= 0) return true;
  if (!Number.isInteger(trade.pricePaise) || trade.pricePaise <= 0) return true;
  if (!Number.isInteger(trade.totalValuePaise) || trade.totalValuePaise <= 0) return true;
  return false;
};

const sweepPendingOrders = async () => {
  try {
    const nowMs = Date.now();
    const pendingOrders = await Trade.find({ status: "PENDING_EXECUTION" })
      .sort({ createdAt: 1, _id: 1 })
      .limit(SWEEP_BATCH_LIMIT)
      .lean();

    for (const trade of pendingOrders) {
      const expired = isExpiredPendingOrder(trade, nowMs);
      const invalid = isInvalidPendingOrder(trade);
      if (!expired && !invalid) continue;

      await runInTransaction(async (session) => {
        const lockedTrade = await Trade.findOneAndUpdate(
          { _id: trade._id, status: "PENDING_EXECUTION" },
          { status: "FAILED" },
          { new: true, session }
        );
        if (!lockedTrade) return;

        if (lockedTrade.type === "BUY") {
          const user = await User.findById(lockedTrade.user).session(session);
          if (user) {
            user.reservedBalancePaise -= lockedTrade.totalValuePaise;
            if (user.reservedBalancePaise < 0) user.reservedBalancePaise = 0;
            await user.save({ session });
          }
        }

        const reason = invalid ? "INVALID_PENDING_ORDER" : "EXPIRED_PENDING_ORDER";
        logger.info(`[OrderSweeper] Marked ${lockedTrade._id} as FAILED (${reason}).`);
      });
    }
  } catch (error) {
    logger.error(`[OrderSweeper] Sweep failed: ${error.message}`);
  }
};

const startSweeper = () => {
  setInterval(sweepPendingOrders, SWEEP_INTERVAL_MS);
  logger.info("[OrderSweeper] Pending-order sweeper started.");
};

module.exports = { sweepPendingOrders, startSweeper };

