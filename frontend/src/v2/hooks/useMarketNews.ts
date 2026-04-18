import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";

export interface NewsSignal {
  event:      string;
  verdict:    string;
  impact:     string | null;
  confidence: number | null;
  judgment:   string;
  sector:     string;
}

export interface NewsData {
  signals: NewsSignal[];
  state:   string;
  status:  string;
}

async function fetchNews(symbol?: string): Promise<NewsData> {
  const url = symbol ? `/market/news?symbol=${encodeURIComponent(symbol)}` : "/intelligence/news";
  const res = await api.get(url);
  // Both endpoints return signals in either res.data.signals or res.data.data.signals
  const signals: NewsSignal[] = res.data?.signals ?? res.data?.data?.signals ?? [];
  return {
    signals,
    state:  res.data?.state ?? res.data?.data?.state ?? "EMPTY",
    status: res.data?.status ?? "OK",
  };
}

/** News for a specific symbol (requires auth) or general market news */
export function useMarketNews(symbol?: string) {
  const { data, isLoading, isError } = useQuery<NewsData>({
    queryKey:  ["market", "news", symbol ?? "general"],
    queryFn:   () => fetchNews(symbol),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry:     1,
  });

  return {
    signals:  data?.signals ?? [],
    state:    data?.state ?? "EMPTY",
    isLoading,
    isError,
  };
}
