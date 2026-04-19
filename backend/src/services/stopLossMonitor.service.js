const User = require("../models/user.model");
const Holding = require("../models/holding.model");
const Trade = require("../models/trade.model");
const marketService = require("./marketData.service");
const tradeService = require("./trade.service");
const logger = require("../utils/logger");
const { buildSystemRequestId } = require("../utils/systemRequestId");
const { acquirePreLock } = require("../utils/systemPreLock");
const { issueDecisionToken } = require("./intelligence/preTradeAuthority.store");
const { isMarketOpen, isSquareoffWindowEligible } = require("./marketHours.service");

/**
 * P1-C — Process-local background loop (setInterval). One web instance = one monitor.
 * Multiple replicas run duplicate scans. See `docs/BACKGROUND_WORKERS_SCALE.md`.
 *
 * Periodically monitors all user holdings and executes Stop Loss orders
 * if the current market quote drops below the defined SL threshold.
 */
class StopLossMonitor {
  constructor() {
    this.interval = null;
    this.isProcessing = false;
  }

  async start(intervalMs = 30000) {
    if (this.interval) return;

    logger.info({ event: "SL_MONITOR_START", intervalMs });

    this.interval = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;
      try {
        await this.checkAllStopLosses();
      } catch (err) {
        logger.error({ event: "SL_MONITOR_CYCLE_ERROR", message: err.message });
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
      if (!isMarketOpen()) return;
      if (isSquareoffWindowEligible()) return;

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

          // Aggregate SL/target across ALL open BUY trades for this holding.
          // Using minimum SL (most conservative — triggers earliest to protect full position)
          // and minimum target (take profit at first achieved target level).
          // This correctly handles averaged positions where different buys have different levels.
          const openBuyTrades = await Trade.find({
            user: user._id,
            symbol,
            type: "BUY",
            status: { $in: ["EXECUTED", "EXECUTED_PENDING_REFLECTION"] },
          }).select("stopLossPaise targetPricePaise").lean();

          if (!openBuyTrades.length) continue;

          const validSLs = openBuyTrades
            .map((t) => t.stopLossPaise)
            .filter((sl) => sl && sl > 0);
          const validTargets = openBuyTrades
            .map((t) => t.targetPricePaise)
            .filter((tp) => tp && tp > 0);

          // No stop loss set on any open trade — nothing to monitor.
          if (!validSLs.length && !validTargets.length) continue;

          const stopLossPaise = validSLs.length ? Math.min(...validSLs) : null;
          const targetPricePaise = validTargets.length ? Math.min(...validTargets) : null;
          let triggerHit = false;
          let exitReason = "";
          let strategyType = "";

          /** Reserve quantity already tied up in an in-flight sell (not legacy "PENDING"). */
          const pendingSells = await Trade.find({
            user: user._id,
            symbol,
            type: "SELL",
            status: { $in: ["PENDING_EXECUTION", "PROCESSING"] },
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

            const idemType = strategyType === "STOP LOSS" ? "SL" : "TARGET";
            const requestId = buildSystemRequestId({
              type: idemType,
              userId: user._id,
              symbol,
            });
            const lockKey = `lock:${requestId}`;
            const slCooldownKey = `SL_LOCK:${userId}:${symbol}`;
            try {
              const cooldownOk = await acquirePreLock(slCooldownKey, 30);
              if (!cooldownOk) {
                logger.info({ event: "SL_COOLDOWN_ACTIVE", userId, symbol });
                continue;
              }

              const acquired = await acquirePreLock(lockKey);
              if (!acquired) {
                logger.info(`[Guardian] Pre-lock busy for ${lockKey}, skipping duplicate worker tick.`);
                continue;
              }

              if (idemType === "SL") {
                logger.info({ event: "SL_TRIGGERED", userId, symbol });
              }

              const authority = await issueDecisionToken({
                symbol,
                productType: data.tradeType,
                pricePaise: currentQuotePaise,
                quantity: availableQuantity,
                stopLossPaise: null,
                targetPricePaise: null,
                verdict: "SELL",
                userId: user._id,
              });

              await tradeService.executeSellTrade(user, {
                symbol,
                productType: data.tradeType,
                quantity: availableQuantity,
                pricePaise: currentQuotePaise,
                token: authority.token,
                requestId,
                reason: exitReason,
                userThinking: `The AI Guardian automatically closed this position as the ${strategyType.toLowerCase()} threshold was breached. This action preserves your capital and adheres to your predefined risk parameters.`,
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
