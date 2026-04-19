const logger = require("../utils/logger");
const { persistUserAnalyticsSnapshot } = require("../services/analytics.service");

/**
 * Outbox / queue consumer: recompute User.analyticsSnapshot from trade history.
 * Must run outside Mongo transactions. Does not throw — reflection + SELL success must not depend on analytics.
 *
 * @param {{ payload?: { userId?: string, tradeId?: string } }}} event
 */
async function handleTradeClosed(event) {
  const userId = event?.payload?.userId;
  if (!userId) {
    logger.warn({ action: "TRADE_CLOSED_ANALYTICS_SKIP", reason: "MISSING_USER_ID" });
    return;
  }
  try {
    await persistUserAnalyticsSnapshot(userId);
  } catch (err) {
    logger.error({
      action: "ANALYTICS_WORKER_FAILED",
      userId: String(userId),
      message: err?.message || String(err),
    });
  }
}

module.exports = { handleTradeClosed };
