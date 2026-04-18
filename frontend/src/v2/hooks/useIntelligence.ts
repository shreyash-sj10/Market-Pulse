import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";

export interface IntelligenceSignal {
  event:      string;
  verdict:    string;
  impact:     string | null;
  confidence: number | null;
  judgment:   string;
  sector:     string;
}

export interface IntelligenceData {
  signals:   IntelligenceSignal[];
  state:     string;
  summary?:  string;
}

async function fetchIntelligence(feed: "news" | "portfolio" | "global"): Promise<IntelligenceData> {
  const res = await api.get(`/intelligence/${feed}`);
  const payload = res.data?.data ?? res.data ?? {};
  return {
    signals: payload.signals ?? [],
    state:   payload.state ?? res.data?.state ?? "EMPTY",
    summary: payload.summary ?? null,
  };
}

/** Market intelligence — used on Home page behavior insight panel */
export function useMarketIntelligence() {
  const { data, isLoading, isError } = useQuery<IntelligenceData>({
    queryKey:  ["intelligence", "news"],
    queryFn:   () => fetchIntelligence("news"),
    staleTime: 120_000,
    refetchInterval: 180_000,
    retry:     1,
  });

  return { signals: data?.signals ?? [], state: data?.state ?? "EMPTY", isLoading, isError };
}

/** Portfolio-specific intelligence — used on Portfolio page */
export function usePortfolioIntelligence() {
  const { data, isLoading, isError } = useQuery<IntelligenceData>({
    queryKey:  ["intelligence", "portfolio"],
    queryFn:   () => fetchIntelligence("portfolio"),
    staleTime: 120_000,
    refetchInterval: 180_000,
    retry:     1,
  });

  return { signals: data?.signals ?? [], state: data?.state ?? "EMPTY", isLoading, isError };
}

/** Global intelligence — commodities, indices, global macro */
export function useGlobalIntelligence() {
  const { data, isLoading, isError } = useQuery<IntelligenceData>({
    queryKey:  ["intelligence", "global"],
    queryFn:   () => fetchIntelligence("global"),
    staleTime: 180_000,
    refetchInterval: 300_000,
    retry:     1,
  });

  return { signals: data?.signals ?? [], state: data?.state ?? "EMPTY", isLoading, isError };
}
