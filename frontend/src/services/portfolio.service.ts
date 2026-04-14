import { api } from "./api";
import type { PortfolioSummary, PortfolioPosition } from "../contracts/portfolio";

export const portfolioService = {
  getSummary: async () => {
    const response = await api.get<{ success: boolean; data: PortfolioSummary; state: string }>(
      "/portfolio/summary"
    );
    return response.data;
  },

  getPositions: async () => {
    const response = await api.get<{ success: boolean; data: PortfolioPosition[]; state: string }>(
      "/portfolio/positions"
    );
    return response.data;
  },
};
