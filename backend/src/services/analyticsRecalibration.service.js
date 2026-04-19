const { persistUserAnalyticsSnapshot } = require("./analytics.service");
const logger = require("../utils/logger");

/**
 * Heavy portfolio analytics recompute (same path as post–TRADE_CLOSED worker).
 * Kept for inline queue handler / legacy USER_ANALYTICS_RECALIBRATE outbox rows.
 */
async function recalibrateUserAnalyticsSnapshot(userId) {
  if (!userId) return;
  try {
    await persistUserAnalyticsSnapshot(userId);
    logger.info({
      action: "USER_ANALYTICS_RECALIBRATED",
      userId: String(userId),
    });
  } catch (e) {
    logger.error({
      action: "USER_ANALYTICS_RECALIBRATION_FAILED",
      userId: String(userId),
      message: e?.message || String(e),
    });
    throw e;
  }
}

module.exports = { recalibrateUserAnalyticsSnapshot };
