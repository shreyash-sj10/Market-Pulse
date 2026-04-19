const Trade = require("../models/trade.model");
const User = require("../models/user.model");
const Holding = require("../models/holding.model");
const pLimit = require("p-limit");
const marketService = require("./marketData.service");
const tradeService = require("./trade.service");
const logger = require("../utils/logger");
const { getIstDateKey } = require("../utils/istDateKey.util");
const { buildSystemRequestId } = require("../utils/systemRequestId");
const { acquirePreLock } = require("../utils/systemPreLock");
const { issueDecisionToken } = require("./intelligence/preTradeAuthority.store");
const { isSquareoffWindowEligible } = require("./marketHours.service");
const { claimExecution, completeExecution, abortExecution } = require("./systemExecutionState.service");

const SQUAREOFF_POLL_MS = Number(process.env.SQUAREOFF_POLL_MS || 60 * 1000);
const SQUAREOFF_CONCURRENCY = Math.max(1, Number(process.env.SQUAREOFF_CONCURRENCY || 10));

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
  }

  async runIfEligible() {
    if (this.isRunning) return;
    if (!isSquareoffWindowEligible()) return;

    const dateKey = getIstDateKey();
    const stateKey = `SQ:${dateKey}`;
    const claim = await claimExecution(stateKey);
    if (!claim) {
      logger.info({ event: "SQUAREOFF_ALREADY_CLAIMED", dateKey });
      return;
    }

    this.isRunning = true;
    try {
      await this.executeAutoSquareoff();
      await completeExecution(stateKey);
      logger.info({ event: "SQUAREOFF_EXECUTED", dateKey });
    } catch (err) {
      await abortExecution(stateKey, err.message);
      logger.error({
        event: "SQUAREOFF_FAILED",
        dateKey,
        message: err.message,
      });
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
        productType: "INTRADAY",
        status: "EXECUTED",
      });

      if (!openIntradayTrades.length) {
        logger.info("[Squareoff] No active intraday positions detected. Protocol idle.");
        return;
      }

      /** One squareoff idempotency key per user+symbol+day — aggregate all open intraday lots. */
      const groupMap = new Map();
      for (const trade of openIntradayTrades) {
        const key = `${String(trade.user)}:${trade.symbol}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            userId: trade.user,
            symbol: trade.symbol,
            quantity: 0,
          });
        }
        const g = groupMap.get(key);
        g.quantity += Math.max(0, Math.round(Number(trade.quantity) || 0));
      }
      const positionGroups = Array.from(groupMap.values());

      const symbols = [...new Set(positionGroups.map((g) => g.symbol))];

      // 2. Capture ALL prices in a single snapshot (Phase 8 Directive)
      const priceSnapshot = await marketService.getLivePrices(symbols);
      logger.info(`[Squareoff] Captured snapshot for ${symbols.length} securities.`);

      const limit = pLimit(SQUAREOFF_CONCURRENCY);
      const executionPromises = positionGroups.map((group) =>
        limit(async () => {
          try {
            const currentPrice = priceSnapshot[group.symbol]?.pricePaise;
            if (!currentPrice) {
              logger.warn(`[Squareoff] Skipping ${group.symbol} - Price unavailable in snapshot.`);
              return null;
            }

            const user = await User.findById(group.userId);
            if (!user) return null;

            const intradayHolding = await Holding.findOne({
              userId: group.userId,
              symbol: group.symbol,
              tradeType: "INTRADAY",
            });
            const squareoffQty = intradayHolding
              ? Math.max(0, Math.round(Number(intradayHolding.quantity) || 0))
              : Math.max(0, Math.round(Number(group.quantity) || 0));
            if (!squareoffQty) {
              logger.info(
                `[Squareoff] No INTRADAY holding quantity for ${group.symbol} (${group.userId}); skipping.`
              );
              return null;
            }

            const requestId = buildSystemRequestId({
              type: "SQ",
              userId: group.userId,
              symbol: group.symbol,
            });
            const acquired = await acquirePreLock(`lock:${requestId}`);
            if (!acquired) {
              logger.info(`[Squareoff] Pre-lock busy for ${requestId}, skipping duplicate worker.`);
              return null;
            }

            const authority = await issueDecisionToken({
              symbol: group.symbol,
              productType: "INTRADAY",
              pricePaise: currentPrice,
              quantity: squareoffQty,
              stopLossPaise: null,
              targetPricePaise: null,
              verdict: "SELL",
              userId: user._id,
            });

            return tradeService.executeSellTrade(user, {
              symbol: group.symbol,
              productType: "INTRADAY",
              quantity: squareoffQty,
              pricePaise: currentPrice,
              token: authority.token,
              requestId,
              reason: "AUTO_SQUAREOFF_PROTOCOL",
              userThinking:
                "System-mandated intraday liquidation executed at market cutoff to adhere to delivery-only risk constraints.",
            });
          } catch (err) {
            logger.error(`[Squareoff] Individual execution failed for ${group.symbol} (${group.userId}): ${err.message}`);
            return null;
          }
        })
      );

      const settled = await Promise.allSettled(executionPromises);
      const successful = settled.filter((r) => r.status === "fulfilled" && r.value).length;

      logger.info(`[Squareoff] Protocol complete. Success: ${successful}/${positionGroups.length}`);

    } catch (err) {
      logger.error(`[Squareoff] CRITICAL FAILURE: ${err.message}`);
      throw err;
    }
  }
}

const squareoffService = new SquareoffService();

const startSquareOff = () => {
  squareoffService.start();
};

module.exports = squareoffService;
module.exports.startSquareOff = startSquareOff;
