const Trade = require("../models/trade.model");
const tradeService = require("./trade.service");
const marketDataService = require("./marketData.service");
const { isMarketOpen } = require("./marketHours.service");
const logger = require("../utils/logger");

/**
 * P1-C — Process-local background loop (setInterval). One web instance = one executor loop.
 * Multiple replicas process overlapping pending orders (trade layer should remain safe, but work duplicates).
 * See `docs/BACKGROUND_WORKERS_SCALE.md`.
 */
const EXECUTOR_INTERVAL_MS = 60 * 1000; // */1 * * * * equivalent
const EXECUTOR_BATCH_LIMIT = 200;

let executorTimer = null;
let isRunning = false;

const processPendingOrders = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    if (!isMarketOpen()) return;

    const pendingOrders = await Trade.find({ status: "PENDING_EXECUTION" })
      .sort({ createdAt: 1, _id: 1 })
      .limit(EXECUTOR_BATCH_LIMIT)
      .select({ _id: 1, symbol: 1 })
      .lean();

    for (const order of pendingOrders) {
      try {
        // Ensure market data is available for execution moment.
        await marketDataService.resolvePrice(order.symbol);

        // Existing execution path owns all status/accounting updates.
        await tradeService.executeOrder(order._id);
      } catch (error) {
        if (error?.message === "MARKET_DATA_UNAVAILABLE") {
          logger.warn(`[ExecutionExecutor] Market data unavailable for ${order.symbol}, keeping order pending (${order._id}).`);
          continue;
        }
        logger.error(`[ExecutionExecutor] Failed order ${order._id}: ${error.message}`);
      }
    }
  } finally {
    isRunning = false;
  }
};

const startExecutionExecutor = () => {
  if (executorTimer) return;

  processPendingOrders().catch((error) => {
    logger.error(`[ExecutionExecutor] Startup run failed: ${error.message}`);
  });

  executorTimer = setInterval(() => {
    processPendingOrders().catch((error) => {
      logger.error(`[ExecutionExecutor] Scheduled run failed: ${error.message}`);
    });
  }, EXECUTOR_INTERVAL_MS);

  logger.info("[ExecutionExecutor] Pending-order executor started (cron */1 * * * *).");
};

module.exports = { processPendingOrders, startExecutionExecutor };

