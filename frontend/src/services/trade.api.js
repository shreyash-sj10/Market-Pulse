import api from "./api.js";
import { normalizeResponse } from "../utils/contract.js";

// --- INTEGRITY HEADERS ---
const getHardenedHeaders = (idempotencyKey, preTradeToken) => ({
  "idempotency-key": idempotencyKey,
  "pre-trade-token": preTradeToken,
});

export const getTradeHistory = async (page = 1, limit = 10) => {
  const response = await api.get(`/trades?page=${page}&limit=${limit}`);
  return normalizeResponse(response);
};

export const getTrades = ({ pageParam = 1 } = {}) => getTradeHistory(pageParam, 10);

export const buyTrade = async ({
  side,
  symbol,
  quantity,
  pricePaise,
  stopLossPaise,
  targetPricePaise,
  userThinking,
  decisionContext,
  idempotencyKey,
  preTradeToken,
}) => {
  const response = await api.post("/trades/buy", {
    side,
    symbol,
    quantity,
    pricePaise,
    stopLossPaise,
    targetPricePaise,
    userThinking,
    decisionContext,
  }, {
    headers: getHardenedHeaders(idempotencyKey, preTradeToken)
  });
  return normalizeResponse(response);
};

export const sellTrade = async ({
  side,
  symbol,
  quantity,
  pricePaise,
  userThinking,
  decisionContext,
  idempotencyKey,
  preTradeToken,
}) => {
  const response = await api.post("/trades/sell", {
    side,
    symbol,
    quantity,
    pricePaise,
    userThinking,
    decisionContext,
  }, {
    headers: getHardenedHeaders(idempotencyKey, preTradeToken)
  });
  return normalizeResponse(response);
};

export const executeTrade = async (params) => {
  if (params.side === "BUY") return buyTrade(params);
  return sellTrade(params);
};
