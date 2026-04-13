const User = require("../models/user.model");
const Holding = require("../models/holding.model");
const Trade = require("../models/trade.model");
const marketService = require("./marketData.service");
const tradeService = require("./trade.service");
const logger = require("../utils/logger");
const { issueDecisionToken } = require("./intelligence/preTradeAuthority.store");

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
      const holdingDocs = await Holding.find({ quantity: { $gt: 0 } });
      if (!holdingDocs.length) {
        this.isRunning = false;
        return;
      }
      const holdingsByUserId = new Map();
      holdingDocs.forEach((holding) => {
        const key = String(holding.userId);
        if (!holdingsByUserId.has(key)) holdingsByUserId.set(key, []);
        holdingsByUserId.get(key).push(holding);
      });
      const users = await User.find({ _id: { $in: Array.from(holdingsByUserId.keys()) } });
      const usersById = new Map(users.map((user) => [String(user._id), user]));

      // Collect all symbols that need quote retrieval
      const symbolsToFetch = new Set();
      holdingDocs.forEach((holding) => symbolsToFetch.add(holding.symbol));

      if (!symbolsToFetch.size) {
        this.isRunning = false;
        return;
      }

      // Batch fetch quotes in paise
      const quoteMap = {};
      const symbolsArray = Array.from(symbolsToFetch);
      
      // We process symbols in chunks of 50 to avoid API limits/long URLs
      for (let i = 0; i < symbolsArray.length; i += 50) {
        const chunk = symbolsArray.slice(i, i + 50);
        const quotePaiseMap = await marketService.getLivePrices(chunk);
        Object.assign(quoteMap, quotePaiseMap);
      }

      // Check triggers for each user
      for (const [userId, userHoldings] of holdingsByUserId.entries()) {
        const user = usersById.get(userId);
        if (!user) continue;

        for (const data of userHoldings) {
          const symbol = data.symbol;
          const resolvedQuote = quoteMap[symbol];
          const currentQuotePaise = resolvedQuote?.pricePaise;
          if (!currentQuotePaise) continue;

          const latestEntry = await Trade.findOne({ user: user._id, symbol, type: "BUY" }).sort({ createdAt: -1 });
          if (!latestEntry) continue;

          const stopLossPaise = latestEntry.stopLossPaise;
          const targetPricePaise = latestEntry.targetPricePaise;
          let triggerHit = false;
          let exitReason = "";

          if (stopLossPaise && currentQuotePaise <= stopLossPaise) {
            triggerHit = true;
            exitReason = `STOP_LOSS_REACHED: quotePaise ${currentQuotePaise} hit SL ${stopLossPaise}`;
          } else if (targetPricePaise && currentQuotePaise >= targetPricePaise) {
            triggerHit = true;
            exitReason = `TAKE_PROFIT_REACHED: quotePaise ${currentQuotePaise} hit TP ${targetPricePaise}`;
          }

          if (triggerHit) {
            logger.info(`Exit trigger hit for ${user.email}: ${symbol} at ${currentQuotePaise} (${resolvedQuote.source})`);
            
            try {
              const authority = await issueDecisionToken({
                symbol,
                pricePaise: currentQuotePaise,
                quantity: data.quantity,
                stopLossPaise: null,
                targetPricePaise: null,
                verdict: "SELL",
                userId: user._id,
              });

              // Execute exit trade
              await tradeService.executeSellTrade(user, {
                symbol,
                quantity: data.quantity,
                pricePaise: currentQuotePaise,
                token: authority.token,
                requestId: `${user._id}:${symbol}:${Date.now()}`,
                reason: exitReason,
                userThinking: "System-executed algorithmic safeguard (Auto-Exit)."
              });
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
