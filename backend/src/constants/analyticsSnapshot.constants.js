/**
 * Single source: how long `User.analyticsSnapshot` is treated as fresh.
 * Used by portfolio summary and analysis summary (aligned TTL).
 * Override with env `ANALYTICS_SNAPSHOT_VALID_MS` (milliseconds).
 */
const ANALYTICS_SNAPSHOT_VALID_MS = Number(process.env.ANALYTICS_SNAPSHOT_VALID_MS) || 24 * 60 * 60 * 1000;

module.exports = { ANALYTICS_SNAPSHOT_VALID_MS };
