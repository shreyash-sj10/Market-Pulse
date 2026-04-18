import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";
import { queryKeys } from "../queryKeys";

export type PortfolioSummary = {
  netEquityPaise: number;
  balancePaise: number;
  unrealizedPnLPaise: number;
  realizedPnLPaise: number;
  totalInvestedPaise: number;
  totalPnlPct: number;
  winRate: number;
  isDegraded: boolean;
};

const EMPTY: PortfolioSummary = {
  netEquityPaise: 0,
  balancePaise: 0,
  unrealizedPnLPaise: 0,
  realizedPnLPaise: 0,
  totalInvestedPaise: 0,
  totalPnlPct: 0,
  winRate: 0,
  isDegraded: true,
};

async function fetchSummary(): Promise<PortfolioSummary> {
  try {
    const res = await api.get("/portfolio/summary");
    const d = res?.data?.data;
    if (!d) return { ...EMPTY };
    return {
      netEquityPaise:      Number(d.totalValuePaise ?? 0),
      balancePaise:        Number(d.balancePaise ?? 0),
      unrealizedPnLPaise:  Number(d.unrealizedPnLPaise ?? 0),
      realizedPnLPaise:    Number(d.realizedPnLPaise ?? 0),
      totalInvestedPaise:  Number(d.totalInvestedPaise ?? 0),
      totalPnlPct:         Number(d.totalPnlPct ?? 0),
      winRate:             Number(res?.data?.data?.winRate ?? 0),
      isDegraded: false,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function usePortfolioSummary() {
  const q = useQuery({
    queryKey: queryKeys.portfolioSummary,
    queryFn: fetchSummary,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    summary: q.data ?? EMPTY,
    isLoading: q.isPending,
    isError: q.isError,
  };
}
