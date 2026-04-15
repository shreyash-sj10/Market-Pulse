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
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
};

// ── Deterministic payload hash (Canonical Stringify) ──────────────────────────
const buildPayloadHash = (payload) => {
  const canonical = {
    symbol: normalizeSymbol(payload.symbol),
    pricePaise: toInteger(payload.pricePaise),
    quantity: toInteger(payload.quantity),
    stopLossPaise: toInteger(payload.stopLossPaise),
    targetPricePaise: toInteger(payload.targetPricePaise),
  };
  
  // Strict canonical sorting for determinism (Phase 3)
  const sortedKeys = Object.keys(canonical).sort();
  // Filter out undefined, preserve null (Phase 3 enforced by toInteger already, but let's be explicit)
  const json = JSON.stringify(canonical, sortedKeys);
  
  // HMAC signing (Phase 2)
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET || "production_secret_fallback")
    .update(json)
    .digest("hex");
};

// ── Issue a new token and persist it to MongoDB ───────────────────────────────

const redisClient = require("../../lib/redisClient");
const logger = require("../../lib/logger");


const issueDecisionToken = async ({ symbol, pricePaise, quantity, stopLossPaise, targetPricePaise, verdict, userId }) => {
  const token = crypto.randomUUID();
  const payloadHash = buildPayloadHash({ symbol, pricePaise, quantity, stopLossPaise, targetPricePaise });
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const data = { token, userId: userId || null, payloadHash, verdict, expiresAt: expiresAt.getTime() };
  if (redisClient && redisClient.status === "ready") {
     try {
       await redisClient.set(`pretrade:${token}`, JSON.stringify(data), "EX", 120);
     } catch(e) { /* fallback */ }
  }
  await PreTradeToken.create({ token, userId: userId || null, payloadHash, verdict, expiresAt });

  return data;
};

const getDecisionRecord = async (token) => {
  if (!token) return null;
  
  if (redisClient && redisClient.status === "ready") {
     try {
       // Atomic Lua script: Get and Delete
       const script = `
         local val = redis.call("GET", KEYS[1])
         if val then
           redis.call("DEL", KEYS[1])
         end
         return val
       `;
       const str = await redisClient.eval(script, 1, `pretrade:${token}`);
       if (str) {
         // Silently keep Mongo clean
         PreTradeToken.deleteOne({ token }).catch(()=>{});
         const obj = JSON.parse(str);
         if (obj.expiresAt <= Date.now()) return null;
         return obj;
       }
     } catch(e) {}
  }
  
  // Atomic Mongo Fetch & Delete
  const record = await PreTradeToken.findOneAndDelete({ token }).lean();
  if (!record) return null;
  if (record.expiresAt <= new Date()) return null;
  return record;
};

const consumeDecisionRecord = async (token) => {
  // NO-OP: Token is now atomically popped by getDecisionRecord
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
