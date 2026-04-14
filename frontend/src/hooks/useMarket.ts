import { useQuery } from "@tanstack/react-query";
import { marketService } from "../services/market.service";

export const useMarket = () => {
  return useQuery({
    queryKey: ["market", "overview"],
    queryFn: marketService.getOverview,
  });
};
