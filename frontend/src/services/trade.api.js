import api from "./api.js";

export const getTradeHistory = async (page = 1, limit = 10) => {
  const response = await api.get(`/trades?page=${page}&limit=${limit}`);
  return response.data;
};

export const getTrades = ({ pageParam = 1 } = {}) => getTradeHistory(pageParam, 10);


export const buyTrade = async ({
  symbol,
  quantity,
  price,
  stopLoss,
  targetPrice,
  reason,
  userThinking,
}) => {
  const response = await api.post("/trades/buy", {
    symbol,
    quantity,
    price,
    stopLoss,
    targetPrice,
    reason,
    userThinking,
  });
  return response.data;
};

export const sellTrade = async ({
  symbol,
  quantity,
  price,
  reason,
  userThinking,
}) => {
  const response = await api.post("/trades/sell", {
    symbol,
    quantity,
    price,
    reason,
    userThinking,
  });
  return response.data;
};
