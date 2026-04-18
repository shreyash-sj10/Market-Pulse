import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";

export interface TickerItem {
  symbol:        string;
  label:         string;
  price:         number;
  changePercent: number;
  currency:      string;
  source:        string;
  isFallback:    boolean;
}

async function fetchTicker(): Promise<TickerItem[]> {
  const res = await api.get("/market/indices");
  const data = res?.data?.data;
  if (Array.isArray(data?.ticker) && data.ticker.length > 0) {
    return data.ticker as TickerItem[];
  }
  // Fallback to just the indices if ticker isn't available yet
  if (Array.isArray(data?.indices) && data.indices.length > 0) {
    return data.indices.map((idx: Record<string, unknown>) => ({
      symbol:        idx.symbol as string,
      label:         idx.symbol as string,
      price:         0,
      changePercent: (idx.changePercent as number) ?? 0,
      currency:      "INR",
      source:        "REAL",
      isFallback:    false,
    }));
  }
  return [];
}

export function useTickerData() {
  const { data = [], isLoading } = useQuery<TickerItem[]>({
    queryKey: ["market", "ticker"],
    queryFn:  fetchTicker,
    refetchInterval: 60_000,
    staleTime:       30_000,
    retry:           1,
  });

  return { ticker: data, isLoading };
}
