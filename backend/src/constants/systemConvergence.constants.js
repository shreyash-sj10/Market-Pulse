/**
 * Bypass analytics snapshot cache when a trade just committed (ms window).
 * Also bypass when lastTradeActivityAt is newer than analyticsSnapshot.lastUpdated.
 */
const RECENT_TRADE_SNAPSHOT_BYPASS_MS = Number(process.env.RECENT_TRADE_SNAPSHOT_BYPASS_MS) || 120000;

/** Max deterministic reflection attempts before marking trade FAILED. */
const REFLECTION_MAX_ATTEMPTS = Number(process.env.REFLECTION_MAX_ATTEMPTS) || 5;

module.exports = { RECENT_TRADE_SNAPSHOT_BYPASS_MS, REFLECTION_MAX_ATTEMPTS };
