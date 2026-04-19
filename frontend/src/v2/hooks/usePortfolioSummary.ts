import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";
import { queryKeys } from "../queryKeys";

export type PendingOrderSummary = {
  tradeId: string;
  symbol: string;
  side: string;
  quantity: number;
  pricePaise: number;
  totalValuePaise: number;
  status: string;
  createdAt?: string;
  /** Self-reported mood when the order was placed. */
  preTradeEmotion?: string | null;
};

export type PortfolioSummary = {
  netEquityPaise: number;
  balancePaise: number;
  unrealizedPnLPaise: number;
  realizedPnLPaise: number;
  totalInvestedPaise: number;
  totalPnlPct: number;
  winRate: number;
  isDegraded: boolean;
  /** Orders placed but not yet executed into holdings (e.g. market closed). */
  pendingOrders: PendingOrderSummary[];
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
  pendingOrders: [],
};

async function fetchSummary(): Promise<PortfolioSummary> {
  try {
    const res = await api.get("/portfolio/summary");
    const d = res?.data?.data;
    if (!d) return { ...EMPTY };
    const rawPending = Array.isArray((d as { pendingOrders?: unknown }).pendingOrders)
      ? (d as { pendingOrders: PendingOrderSummary[] }).pendingOrders
      : [];
    // Backend `adaptPortfolio` exposes cash as `balancePaise` (see portfolio.adapter.js).
    // Raw controller fields use `balance` / `netEquity` — accept both for resilience.
    return {
      netEquityPaise:      Number(d.netEquity ?? d.totalValuePaise ?? 0),
      balancePaise:        Number(d.balancePaise ?? d.balance ?? 0),
      unrealizedPnLPaise:  Number(d.unrealizedPnL ?? d.unrealizedPnLPaise ?? 0),
      realizedPnLPaise:    Number(d.realizedPnL ?? d.realizedPnLPaise ?? 0),
      totalInvestedPaise:  Number(d.totalInvested ?? d.totalInvestedPaise ?? 0),
      totalPnlPct:         Number(d.totalPnlPct ?? 0),
      winRate:             Number(d.winRate ?? 0),
      isDegraded: false,
      pendingOrders: rawPending,
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
    refetchOnWindowFocus: false,
  });

  return {
    summary: q.data ?? EMPTY,
    isLoading: q.isPending,
    isError: q.isError,
  };
}
