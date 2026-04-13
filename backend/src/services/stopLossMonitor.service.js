const User = require("../models/user.model");
const Holding = require("../models/holding.model");
const Trade = require("../models/trade.model");
const marketService = require("./marketData.service");
const tradeService = require("./trade.service");
const logger = require("../utils/logger");
const { issueDecisionToken } = require("./intelligence/preTradeAuthority.store");


/**
 * Periodically monitors all user holdings and executes Stop Loss orders
 * if the current market quote drops below the defined SL threshold.
 */
class StopLossMonitor {
  constructor() {
    this.interval = null;
    this.isProcessing = false;
  }

  async start(intervalMs = 30000) { // Default 30 seconds
    if (this.interval) return;
    
    console.log(`[SL-Monitor] Starting Stop Loss Monitoring every ${intervalMs}ms...`);
    
    this.interval = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;
      try {
        await this.checkAllStopLosses();
      } catch (err) {
        console.error("[SL-Monitor] Error in monitoring cycle:", err.message);
      } finally {
        this.isProcessing = false;
      }
    }, intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async checkAllStopLosses() {
    try {
      // 1. Find all users who have at least one holding
      // In MongoDB, checking if a Map field has at least one entry can be done by checking size of object keys if stored as object,
      // but Mongoose Map is stored as a subdocument object. A simple existence check is usually enough to start.
      const holdingDocs = await Holding.find({ quantity: { $gt: 0 } });
      const holdingsByUserId = new Map();
      holdingDocs.forEach((holding) => {
        const key = String(holding.userId);
        if (!holdingsByUserId.has(key)) holdingsByUserId.set(key, []);
        holdingsByUserId.get(key).push(holding);
      });
      const users = await User.find({ _id: { $in: Array.from(holdingsByUserId.keys()) } });
      const usersById = new Map(users.map((user) => [String(user._id), user]));
      
      if (!users.length) return;

      for (const [userId, userHoldings] of holdingsByUserId.entries()) {
        const user = usersById.get(userId);
        if (!user) continue;

        const symbolsToCheck = userHoldings.map((holding) => holding.symbol);
        if (!symbolsToCheck.length) continue;

        // 2. Fetch current quote paise values for all symbols in this user's holdings
        const quotePaiseMap = await marketService.getLivePrices(symbolsToCheck);

        for (const data of userHoldings) {
          const symbol = data.symbol;
          const resolvedQuote = quotePaiseMap[symbol];
          const currentQuotePaise = resolvedQuote?.pricePaise;
          if (!currentQuotePaise) continue;

          const latestEntry = await Trade.findOne({ user: user._id, symbol, type: "BUY" }).sort({ createdAt: -1 });
          if (!latestEntry) continue;

          const stopLossPaise = latestEntry.stopLossPaise;
          const targetPricePaise = latestEntry.targetPricePaise;
          let triggerHit = false;
          let exitReason = "";
          let strategyType = "";

          const pendingSells = await Trade.find({
            user: user._id,
            symbol,
            type: "SELL",
            status: "PENDING"
          });

          const pendingSellQuantity = pendingSells.reduce((sum, trade) => sum + (trade.quantity || 0), 0);
          const availableQuantity = data.quantity - pendingSellQuantity;

          if (availableQuantity <= 0) continue;

          // Check Stop Loss
          if (stopLossPaise && stopLossPaise > 0 && currentQuotePaise <= stopLossPaise) {
            triggerHit = true;
            strategyType = "STOP LOSS";
            exitReason = "STOP LOSS TRIGGERED AUTOMATICALLY";
          } 
          // Check Take Profit (Target Level)
          else if (targetPricePaise && targetPricePaise > 0 && currentQuotePaise >= targetPricePaise) {
            triggerHit = true;
            strategyType = "TAKE PROFIT";
            exitReason = "TAKE PROFIT TARGET REACHED AUTOMATICALLY";
          }

          if (triggerHit) {
            logger.info(`[Guardian] ${strategyType} Tripped for ${user.email} | ${symbol} at ${currentQuotePaise} (${resolvedQuote.source})`);
            
            try {
              const authority = await issueDecisionToken({
                symbol,
                pricePaise: currentQuotePaise,
                quantity: availableQuantity,
                stopLossPaise: null,
                targetPricePaise: null,
                verdict: "SELL",
                userId: user._id,
              });

              await tradeService.executeSellTrade(user, {
                symbol,
                quantity: availableQuantity,
                pricePaise: currentQuotePaise,
                token: authority.token,
                requestId: `${user._id}:${symbol}:${Date.now()}`,
                reason: exitReason,
                userThinking: `The AI Guardian automatically closed this position as the ${strategyType.toLowerCase()} threshold was breached. This action preserves your capital and adheres to your predefined risk parameters.`
              });
            } catch (sellErr) {
              logger.error(`[Guardian] Sell execution failure for ${symbol}: ${sellErr.message}`);
            }
          }
        }
      }
    } catch (err) {
      logger.error(`[Guardian] Monitoring cycle error: ${err.message}`);
    }
  }
}

module.exports = new StopLossMonitor();
