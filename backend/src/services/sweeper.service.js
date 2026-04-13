const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const { runInTransaction } = require("../utils/transaction");
const logger = require("../lib/logger");

const sweepStaleTrades = async () => {
  try {
    const timeoutThreshold = new Date(Date.now() - 60000); // 60s
    const staleTrades = await Trade.find({
      status: "PENDING_EXECUTION",
      createdAt: { $lt: timeoutThreshold }
    });

    for (const trade of staleTrades) {
      await runInTransaction(async (session) => {
        // Lock trade
        const lockedTrade = await Trade.findOneAndUpdate(
          { _id: trade._id, status: "PENDING_EXECUTION" },
          { status: "FAILED" },
          { new: true, session }
        );
        
        if (!lockedTrade) return; // Might have been executed simultaneously

        if (lockedTrade.type === "BUY") {
          const user = await User.findById(lockedTrade.user).session(session);
          if (user) {
             // Release the exact reserve balance allocated for this trade
             user.reservedBalancePaise -= lockedTrade.totalValuePaise;
             if (user.reservedBalancePaise < 0) user.reservedBalancePaise = 0;
             await user.save({ session });
          }
        }
        logger.info(`[Sweeper] Reverted stale trade \${lockedTrade._id} and released funds.`);
      });
    }
  } catch(e) {
    logger.error(`[Sweeper] Failed to sweep stale trades: \${e.message}`);
  }
};

const startSweeper = () => {
   setInterval(sweepStaleTrades, 30000);
   logger.info("[Sweeper] Sweeper polling started.");
};

module.exports = { sweepStaleTrades, startSweeper };
