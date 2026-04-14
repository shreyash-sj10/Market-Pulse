import { api } from "./api";
import type { PreTradeResponse } from "../contracts/preTrade";

export const intelligenceService = {
  getPreTradeAudit: async (payload: {
    symbol: string;
    type: "BUY" | "SELL";
    quantity: number;
    pricePaise: number;
    stopLossPaise?: number;
    targetPricePaise?: number;
    userThinking: string;
  }) => {
    const response = await api.post<{ success: boolean; data: PreTradeResponse; state: string }>(
      "/intelligence/pre-trade",
      payload
    );
    return response.data;
  },
};
