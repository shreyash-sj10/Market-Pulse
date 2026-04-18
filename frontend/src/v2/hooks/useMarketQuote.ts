import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";

export interface LiveQuote {
  pricePaise: number;
  source:     string;
  isFallback: boolean;
  isStale:    boolean;
}

async function fetchQuote(symbol: string): Promise<LiveQuote | null> {
  if (!symbol) return null;
  const res = await api.get(`/market/quote?symbol=${encodeURIComponent(symbol)}`);
  return res.data?.data ?? null;
}

/** Live price for a single symbol — used by DecisionPanel to pre-fill price */
export function useMarketQuote(symbol: string | null) {
  const { data, isLoading } = useQuery<LiveQuote | null>({
    queryKey:  ["market", "quote", symbol],
    queryFn:   () => fetchQuote(symbol!),
    enabled:   Boolean(symbol),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry:     1,
  });

  return { quote: data ?? null, isLoading };
}
