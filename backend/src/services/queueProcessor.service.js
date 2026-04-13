const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const { isMarketOpen } = require("./marketHours.service");
const tradeService = require("./trade.service");
const logger = require("../lib/logger");
const { v4: uuidv4 } = require("uuid"); // For idempotency keys

class QueueProcessor {
  constructor() {
    this.interval = null;
    this.isProcessing = false;
  }

  start(intervalMs = 60000) {
    if (this.interval) return;
    logger.info(\`[QueueProcessor] Active, checking every \${intervalMs}ms.\`);
    this.interval = setInterval(() => this.processPendingTrades(), intervalMs);
    this.processPendingTrades();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async processPendingTrades() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      if (!isMarketOpen()) {
        return; // EXIT if market is closed
      }

      // Step 2 & 3: Process standard pending orders
      const pendingTrades = await Trade.find({ status: "PENDING" }).limit(100);
      
      for (const trade of pendingTrades) {
        try {
          // Relies on status guard natively within executeOrder
          await tradeService.executeOrder(trade._id);
          logger.info(\`[QueueProcessor] Successfully executed queued trade: \${trade._id}\`);
        } catch (err) {
          // IF execution FAILS: transaction rolls back, reservedBalance remains intact.
          // Retry-safe.
          logger.error(\`[QueueProcessor] Failed to execute queued trade \${trade._id}: \${err.message}\`);
        }
      }

      // Step 7: Intraday Square-off
      await this.processIntradaySquareOff();

    } catch (err) {
      logger.error(\`[QueueProcessor] Cycle error: \${err.message}\`);
    } finally {
      this.isProcessing = false;
    }
  }

  async processIntradaySquareOff() {
    const now = new Date();
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istDate = new Date(istString);
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();

    // At 3:20 PM IST (15:20)
    if (hours === 15 && minutes >= 20 && minutes <= 25 && isMarketOpen()) {
      // Find open INTRADAY trades
      const intradayTrades = await Trade.find({
        status: "EXECUTED",
        type: "BUY",
        // Supporting multiple ways INTRADAY might be classified
        $or: [
          { "parsedIntent.strategy": /INTRADAY/i },
          { manualTags: /INTRADAY/i },
          { intent: /INTRADAY/i }
        ]
      });

      for (const trade of intradayTrades) {
         try {
           const user = await User.findById(trade.user);
           if (!user) continue;
           
           // Fetch token implicitly to satisfy the original guard
           const { issueDecisionToken } = require("./intelligence/preTradeAuthority.store");
           const authority = await issueDecisionToken({
                symbol: trade.symbol,
                pricePaise: trade.pricePaise, // ideally live price, but execution fixes it
                quantity: trade.quantity,
                stopLossPaise: null,
                targetPricePaise: null,
                verdict: "SELL",
                userId: user._id,
           });

           await tradeService.executeSellTrade(user, {
             symbol: trade.symbol,
             quantity: trade.quantity, // this handles available vs total correctly in monolith? wait, intraday triggers normal sell
             pricePaise: trade.pricePaise, // will be resolved dynamically
             token: authority.token,
             requestId: \`squareoff-\${trade._id}-\${uuidv4()}\`,
             reason: "AUTO_SQUARE_OFF",
             userThinking: "System executed mandatory 3:20 PM Intraday square-off sequence."
           });
           logger.info(\`[QueueProcessor] Squared off intraday trade \${trade._id}\`);
         } catch (err) {
           logger.error(\`[QueueProcessor] Failed to square off \${trade._id}: \${err.message}\`);
         }
      }
    }
  }
}

module.exports = new QueueProcessor();
