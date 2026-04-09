const User = require("../models/user.model");
const Trade = require("../models/trade.model");
const marketService = require("./marketData/marketData.service");
const tradeService = require("./trade.service");
const logger = require("../utils/logger");

/**
 * StopLossMonitor
 * Scans all user holdings and executes automatic exit orders if SL/TP triggers are hit.
 */
class MonitorService {
  constructor() {
    this.isPunning = false;
  }

  async start() {
    logger.info("Initializing Algorithm Guardian (Stop-Loss Monitor)...");
    // Run every 2 minutes
    setInterval(() => this.scanHoldings(), 120000);
    // Initial scan
    this.scanHoldings();
  }

  async scanHoldings() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const users = await User.find({ "holdings.0": { $exists: true } });
      if (!users.length) {
        this.isRunning = false;
        return;
      }

      // Collect all symbols that need pricing
      const symbolsToFetch = new Set();
      users.forEach(user => {
        for (const [symbol] of user.holdings) {
          symbolsToFetch.add(symbol);
        }
      });

      if (!symbolsToFetch.size) {
        this.isRunning = false;
        return;
      }

      // Batch fetch prices
      const priceMap = {};
      const symbolsArray = Array.from(symbolsToFetch);
      
      // We process symbols in chunks of 50 to avoid API limits/long URLs
      for (let i = 0; i < symbolsArray.length; i += 50) {
        const chunk = symbolsArray.slice(i, i + 50);
        const prices = await marketService.getLivePrices(chunk);
        Object.assign(priceMap, prices);
      }

      // Check triggers for each user
      for (const user of users) {
        let hasChanges = false;
        const holdings = user.holdings;

        for (const [symbol, data] of holdings) {
          const currentPrice = priceMap[symbol];
          if (!currentPrice) continue;

          let triggerHit = false;
          let exitReason = "";

          if (data.stopLoss && currentPrice <= data.stopLoss) {
            triggerHit = true;
            exitReason = `STOP_LOSS_REACHED: Price ${currentPrice} hit SL ${data.stopLoss}`;
          } else if (data.targetPrice && currentPrice >= data.targetPrice) {
            triggerHit = true;
            exitReason = `TAKE_PROFIT_REACHED: Price ${currentPrice} hit TP ${data.targetPrice}`;
          }

          if (triggerHit) {
            logger.info(`🚨 Exit Trigger hit for ${user.email}: ${symbol} at ${currentPrice}`);
            
            try {
              // Execute exit trade
              await tradeService.executeSellTrade(user, {
                symbol,
                quantity: data.quantity,
                price: currentPrice,
                reason: exitReason,
                userThinking: "System-executed algorithmic safeguard (Auto-Exit)."
              });
              hasChanges = true;
            } catch (tradeErr) {
              logger.error(`Failed auto-exit for ${user.email} on ${symbol}: ${tradeErr.message}`);
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Monitor Scan Error: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = new MonitorService();
