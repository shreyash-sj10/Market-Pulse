import { useQuery } from "@tanstack/react-query";
import { portfolioService } from "../services/portfolio.service";

export const usePortfolioSummary = () => {
  return useQuery({
    queryKey: ["portfolio", "summary"],
    queryFn: portfolioService.getSummary,
  });
};

export const usePortfolioPositions = () => {
  return useQuery({
    queryKey: ["portfolio", "positions"],
    queryFn: portfolioService.getPositions,
  });
};
