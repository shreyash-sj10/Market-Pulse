const User = require("../models/user.model");
const Trade = require("../models/trade.model");
const marketService = require("./marketData/marketData.service");
const tradeService = require("./trade.service");
const logger = require("../utils/logger");
const { fromSafeKey } = require("../utils/safeUtils");


/**
 * Periodically monitors all user holdings and executes Stop Loss orders
 * if the current market price drops below the defined SL threshold.
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
      const users = await User.find({ "holdings": { $ne: {} } });
      
      if (!users.length) return;

      for (const user of users) {
        const symbolsToCheck = Array.from(user.holdings.keys()).map(fromSafeKey);
        if (!symbolsToCheck.length) continue;

        // 2. Fetch current prices for all symbols in this user's holdings
        const priceMap = await marketService.getLivePrices(symbolsToCheck);

        for (const [safeSymbol, data] of user.holdings.entries()) {
          const symbol = fromSafeKey(safeSymbol);
          const currentPrice = priceMap[symbol];
          if (!currentPrice) continue;

          let triggerHit = false;
          let exitReason = "";
          let strategyType = "";

          // Check Stop Loss
          if (data.stopLoss && data.stopLoss > 0 && currentPrice <= data.stopLoss) {
            triggerHit = true;
            strategyType = "STOP LOSS";
            exitReason = "STOP LOSS TRIGGERED AUTOMATICALLY";
          } 
          // Check Take Profit (Target Price)
          else if (data.targetPrice && data.targetPrice > 0 && currentPrice >= data.targetPrice) {
            triggerHit = true;
            strategyType = "TAKE PROFIT";
            exitReason = "TAKE PROFIT TARGET REACHED AUTOMATICALLY";
          }

          if (triggerHit) {
            logger.info(`[Guardian] ${strategyType} Tripped for ${user.email} | ${symbol} at ${currentPrice}`);
            
            try {
              await tradeService.executeSellTrade(user, {
                symbol,
                quantity: data.quantity,
                price: currentPrice,
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
