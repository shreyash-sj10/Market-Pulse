import { useMutation } from "@tanstack/react-query";
import { getPreTradeGuard } from "../services/intelligence.api";

export function usePreTrade() {
  const mutation = useMutation({
    mutationFn: (payload) => getPreTradeGuard(payload),
  });

  const reviewTrade = async (payload) => {
    const response = await mutation.mutateAsync(payload);
    return response?.data ?? null;
  };

  return {
    reviewTrade,
    isReviewing: mutation.isPending,
  };
}
