import { api } from "./api";
import type { Trade } from "../contracts/trade";

export const tradeService = {
  getHistory: async () => {
    const response = await api.get<{ success: boolean; data: Trade[]; state: string }>("/trades");
    return response.data;
  },

  buy: async (payload: {
    symbol: string;
    quantity: number;
    pricePaise: number;
    stopLossPaise: number;
    targetPricePaise: number;
    userThinking: string;
    preTradeToken: string;
  }) => {
    const response = await api.post<{ success: boolean; data: Trade; state: string }>(
      "/trades/buy",
      payload,
      {
        headers: {
          "idempotency-key": crypto.randomUUID(),
          "pre-trade-token": payload.preTradeToken,
        },
      }
    );
    return response.data;
  },

  sell: async (payload: {
    symbol: string;
    quantity: number;
    pricePaise: number;
    userThinking: string;
    preTradeToken: string;
  }) => {
    const response = await api.post<{ success: boolean; data: Trade; state: string }>(
      "/trades/sell",
      payload,
      {
        headers: {
          "idempotency-key": crypto.randomUUID(),
          "pre-trade-token": payload.preTradeToken,
        },
      }
    );
    return response.data;
  },
};
