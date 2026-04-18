const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const marketService = require("./marketData.service");
const tradeService = require("./trade.service");
const logger = require("../utils/logger");
const { issueDecisionToken } = require("./intelligence/preTradeAuthority.store");
const { isMarketOpen } = require("./marketHours.service");

const SQUAREOFF_POLL_MS = Number(process.env.SQUAREOFF_POLL_MS || 60 * 1000);
const IST_TZ = "Asia/Kolkata";

/**
 * AUTO-SQUAREOFF SCALING LAYER (PHASE 8)
 * 
 * Prevents sequential lag during market close by capturing a 
 * single price snapshot and executing liquidations in parallel.
 */
class SquareoffService {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.lastSquareoffDate = null;
  }

  getIstDateKey(now = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: IST_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(now);
  }

  async runIfEligible() {
    if (this.isRunning) return;
    if (isMarketOpen()) return;

    const dateKey = this.getIstDateKey();
    if (this.lastSquareoffDate === dateKey) return;

    this.isRunning = true;
    try {
      await this.executeAutoSquareoff();
      this.lastSquareoffDate = dateKey;
    } catch (err) {
      logger.error(`[Squareoff] Scheduler cycle failed: ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.runIfEligible().catch((err) => {
        logger.error(`[Squareoff] Scheduler crash intercepted: ${err.message}`);
      });
    }, SQUAREOFF_POLL_MS);
    logger.info("[Squareoff] Scheduler started.");
  }

  async executeAutoSquareoff() {
    try {
      logger.info("[Squareoff] Initiating institutional intraday liquidation protocol...");

      // 1. Fetch all open INTRADAY positions
      const openIntradayTrades = await Trade.find({
        type: "BUY",
        status: "EXECUTED",
        // We assume symbols needing squareoff are those with active holdings
      });

      if (!openIntradayTrades.length) {
        logger.info("[Squareoff] No active intraday positions detected. Protocol idle.");
        return;
      }

      const symbols = [...new Set(openIntradayTrades.map(t => t.symbol))];

      // 2. Capture ALL prices in a single snapshot (Phase 8 Directive)
      const priceSnapshot = await marketService.getLivePrices(symbols);
      logger.info(`[Squareoff] Captured snapshot for ${symbols.length} securities.`);

      // 3. Process Trades in Parallel (Phase 8 Directive)
      const executionPromises = openIntradayTrades.map(async (trade) => {
        try {
          const currentPrice = priceSnapshot[trade.symbol]?.pricePaise;
          if (!currentPrice) {
            logger.warn(`[Squareoff] Skipping ${trade.symbol} - Price unavailable in snapshot.`);
            return;
          }

          const user = await User.findById(trade.user);
          if (!user) return;

          // Issue internal decision token for the liquidation
          const authority = await issueDecisionToken({
            symbol: trade.symbol,
            pricePaise: currentPrice,
            quantity: trade.quantity,
            stopLossPaise: null,
            targetPricePaise: null,
            verdict: "SELL",
            userId: user._id,
          });

          return tradeService.executeSellTrade(user, {
            symbol: trade.symbol,
            quantity: trade.quantity,
            pricePaise: currentPrice,
            token: authority.token,
            requestId: `squareoff_${trade._id}_${Date.now()}`,
            reason: "AUTO_SQUAREOFF_PROTOCOL",
            userThinking: "System-mandated intraday liquidation executed at market cutoff to adhere to delivery-only risk constraints."
          });
        } catch (err) {
          logger.error(`[Squareoff] Individual execution failed for Trade ${trade._id}: ${err.message}`);
        }
      });

      const results = await Promise.all(executionPromises);
      const successful = results.filter(r => r).length;
      
      logger.info(`[Squareoff] Protocol complete. Success: ${successful}/${openIntradayTrades.length}`);

    } catch (err) {
      logger.error(`[Squareoff] CRITICAL FAILURE: ${err.message}`);
    }
  }
}

const squareoffService = new SquareoffService();

const startSquareOff = () => {
  squareoffService.start();
};

module.exports = squareoffService;
module.exports.startSquareOff = startSquareOff;
