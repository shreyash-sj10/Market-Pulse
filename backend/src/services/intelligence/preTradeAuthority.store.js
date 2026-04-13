/**
 * PRE-TRADE AUTHORITY STORE — PERSISTENT (DB-backed)
 *
 * Replaces the old in-memory Map with a MongoDB collection so tokens
 * survive server restarts and work correctly across multiple instances.
 *
 * Public API is intentionally kept identical to the previous Map-based
 * implementation except that issueDecisionToken, getDecisionRecord and
 * consumeDecisionRecord are now async (callers were already in async
 * contexts, so no contract breakage).
 */
const crypto = require("crypto");
const PreTradeToken = require("../../models/preTradeToken.model");

const TOKEN_TTL_MS = 2 * 60 * 1000; // 2 minutes

// ── Symbol normalisation (same rules as trade.service) ───────────────────────
const normalizeSymbol = (symbol) => {
  if (!symbol) return "";
  const s = String(symbol).toUpperCase().trim();
  if (s.endsWith(".NS") || s.endsWith(".BO")) return s;
  return `${s}.NS`;
};

// ── Integer coercion (same rules as before) ───────────────────────────────────
const toInteger = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
};

// ── Deterministic payload hash ────────────────────────────────────────────────
const buildPayloadHash = ({ symbol, pricePaise, quantity, stopLossPaise, targetPricePaise }) => {
  const canonical = {
    symbol: normalizeSymbol(symbol),
    pricePaise: toInteger(pricePaise),
    quantity: toInteger(quantity),
    stopLossPaise: toInteger(stopLossPaise),
    targetPricePaise: toInteger(targetPricePaise),
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
};

// ── Issue a new token and persist it to MongoDB ───────────────────────────────
const issueDecisionToken = async ({ symbol, pricePaise, quantity, stopLossPaise, targetPricePaise, verdict, userId }) => {
  const token = crypto.randomUUID();
  const payloadHash = buildPayloadHash({ symbol, pricePaise, quantity, stopLossPaise, targetPricePaise });
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await PreTradeToken.create({ token, userId: userId || null, payloadHash, verdict, expiresAt });

  return { token, payloadHash, verdict, expiresAt: expiresAt.getTime() };
};

// ── Retrieve a record, returning null if not found or expired ─────────────────
// NOTE: MongoDB TTL index expires documents eventually; we also guard here
// in case the TTL daemon hasn't run yet.
const getDecisionRecord = async (token) => {
  if (!token) return null;
  const record = await PreTradeToken.findOne({ token }).lean();
  if (!record) return null;
  if (record.expiresAt <= new Date()) {
    await PreTradeToken.deleteOne({ token });
    return null;
  }
  return record; // { token, payloadHash, verdict, expiresAt, userId }
};

// ── Consume (delete) the token after use to enforce single-use ────────────────
const consumeDecisionRecord = async (token) => {
  await PreTradeToken.deleteOne({ token });
};

// ── Test helpers (mirror of old __testables interface) ───────────────────────
const __testables = {
  buildPayloadHash,
  issueDecisionToken,
  getDecisionRecord,
  consumeDecisionRecord,
  // clearStore: deletes all tokens — used in test teardown
  clearStore: async () => {
    await PreTradeToken.deleteMany({});
  },
  // getStoreSize: count of live tokens — used in test assertions
  getStoreSize: async () => PreTradeToken.countDocuments({}),
};

module.exports = {
  buildPayloadHash,
  issueDecisionToken,
  getDecisionRecord,
  consumeDecisionRecord,
  __testables,
};
