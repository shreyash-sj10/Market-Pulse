import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tradeService } from "../services/trade.service";

export const useTradeHistory = () => {
  return useQuery({
    queryKey: ["trades"],
    queryFn: tradeService.getHistory,
  });
};

export const useBuyTrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tradeService.buy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: ["user", "profile"] });
    },
  });
};

export const useSellTrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tradeService.sell,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: ["user", "profile"] });
    },
  });
};
