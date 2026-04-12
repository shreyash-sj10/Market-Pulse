import api from "./api.js";

// --- INTEGRITY HEADERS ---
const getHardenedHeaders = (idempotencyKey, preTradeToken) => ({
  "idempotency-key": idempotencyKey,
  "pre-trade-token": preTradeToken,
});

export const getTradeHistory = async (page = 1, limit = 10) => {
  const response = await api.get(`/trades?page=${page}&limit=${limit}`);
  return response.data;
};

export const getTrades = ({ pageParam = 1 } = {}) => getTradeHistory(pageParam, 10);

export const buyTrade = async ({
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
  return response.data;
};

export const sellTrade = async ({
  symbol,
  quantity,
  pricePaise,
  userThinking,
  decisionContext,
  idempotencyKey,
  preTradeToken,
}) => {
  const response = await api.post("/trades/sell", {
    symbol,
    quantity,
    pricePaise,
    userThinking,
    decisionContext,
  }, {
    headers: getHardenedHeaders(idempotencyKey, preTradeToken)
  });
  return response.data;
};

export const executeTrade = async (params) => {
  if (params.type === "BUY") return buyTrade(params);
  return sellTrade(params);
};

