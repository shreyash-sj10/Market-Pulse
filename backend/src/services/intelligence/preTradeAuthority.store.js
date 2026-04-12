const crypto = require("crypto");

const TOKEN_TTL_MS = 2 * 60 * 1000;
const decisionStore = new Map();

const normalizeSymbol = (symbol) => {
  if (!symbol) return "";
  const s = String(symbol).toUpperCase().trim();
  if (s.endsWith(".NS") || s.endsWith(".BO")) return s;
  return `${s}.NS`;
};

const toRoundedNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
};

const toInteger = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
};

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

const issueDecisionToken = ({ symbol, pricePaise, quantity, stopLossPaise, targetPricePaise, verdict }) => {
  const token = crypto.randomUUID();
  const payloadHash = buildPayloadHash({ symbol, pricePaise, quantity, stopLossPaise, targetPricePaise });
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  decisionStore.set(token, { payloadHash, verdict, expiresAt });
  return { token, payloadHash, verdict, expiresAt };
};


const getDecisionRecord = (token) => {
  if (!token) return null;
  const record = decisionStore.get(token);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    decisionStore.delete(token);
    return null;
  }
  return record;
};

const consumeDecisionRecord = (token) => {
  decisionStore.delete(token);
};

const __testables = {
  buildPayloadHash,
  issueDecisionToken,
  getDecisionRecord,
  consumeDecisionRecord,
  clearStore: () => decisionStore.clear(),
  getStoreSize: () => decisionStore.size,
};

module.exports = {
  buildPayloadHash,
  issueDecisionToken,
  getDecisionRecord,
  consumeDecisionRecord,
  __testables,
};
