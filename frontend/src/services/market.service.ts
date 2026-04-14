import { api } from "./api";
import type { MarketOverview } from "../contracts/market";

export const marketService = {
  getOverview: async () => {
    const response = await api.get<{ success: boolean; data: MarketOverview; state: string }>(
      "/market/overview"
    );
    return response.data;
  },
};
