import { useQuery } from "@tanstack/react-query";
import { getMarketNews } from "../api/market.api.js";
import { queryKeys } from "../queryKeys";
import { isAiInsightsUnavailable } from "../intelligence/integration";

export function useAiInsightsAvailability() {
  const q = useQuery({
    queryKey: queryKeys.aiInsights,
    queryFn: async () => {
      const res = await getMarketNews();
      const unavailable = isAiInsightsUnavailable(res);
      if (unavailable) {
        console.warn("AI unavailable");
      }
      return { available: !unavailable };
    },
    staleTime: 60_000,
    retry: 1,
  });

  return {
    available: q.data?.available ?? false,
    isLoading: q.isPending,
    isError: q.isError,
  };
}
