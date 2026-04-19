const { getIstDateKey } = require("./istDateKey.util");

/** YYYY-MM-DD in Asia/Kolkata — same semantics as legacy idempotency day keys. */
function getISTDateKey(now) {
  return getIstDateKey(now);
}

/**
 * Deterministic idempotency key for automated actions (SL / target / squareoff).
 * Same value across retries, processes, and scheduler ticks for that calendar day.
 *
 * @param {{ type: string, userId: unknown, symbol: string }} params
 * @returns {string} e.g. SL:507f1f77bcf86cd799439011:RELIANCE.NS:2026-04-19
 */
function buildSystemRequestId({ type, userId, symbol }) {
  const dateKey = getISTDateKey();
  const uid = String(userId);
  const sym = String(symbol || "").trim().toUpperCase();
  return `${type}:${uid}:${sym}:${dateKey}`;
}

module.exports = {
  buildSystemRequestId,
  getISTDateKey,
};
