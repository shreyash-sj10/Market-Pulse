import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";

export type MarketIndex = {
  symbol: string;
  pricePaise: number;
  changePercent: number;
};

async function fetchIndices(): Promise<MarketIndex[]> {
  try {
    const res = await api.get("/market/indices");
    const data = res?.data?.data;
    const indices = Array.isArray(data?.indices) ? data.indices : [];
    if (!indices.length) return getStaticFallback();
    return indices.map((idx: Record<string, unknown>) => ({
      symbol: String(idx.symbol ?? ""),
      pricePaise: Number(idx.pricePaise ?? 0),
      changePercent: Number(idx.changePercent ?? 0),
    }));
  } catch {
    return getStaticFallback();
  }
}

function getStaticFallback(): MarketIndex[] {
  return [
    { symbol: "NIFTY 50", pricePaise: 0, changePercent: 0 },
    { symbol: "SENSEX",   pricePaise: 0, changePercent: 0 },
    { symbol: "BANK NIFTY",pricePaise: 0, changePercent: 0 },
  ];
}

export function useMarketIndices() {
  const q = useQuery({
    queryKey: ["market-indices"],
    queryFn: fetchIndices,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    indices: q.data ?? getStaticFallback(),
    isLoading: q.isPending,
    isDegraded: q.isError || (q.data?.every((i) => i.pricePaise === 0) ?? true),
  };
}
