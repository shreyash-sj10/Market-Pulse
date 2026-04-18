import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";

export interface Fundamentals {
  trailingPE: number | null;
  forwardPE: number | null;
  marketCap: number | null;
  dividendYield: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  beta: number | null;
  eps: number | null;
  debtToEquity: number | null;
  returnOnEquity: number | null;
}

function rawNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "object" && v !== null && "raw" in v) {
    const n = Number((v as { raw: unknown }).raw);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function trailingPeFromModules(
  d: Record<string, unknown>,
  ks: Record<string, unknown>,
): number | null {
  const fromDetail = rawNum(d.trailingPE);
  if (fromDetail != null) return fromDetail;
  return rawNum(ks.trailingPE);
}

async function fetchFundamentals(symbol: string): Promise<Fundamentals> {
  const res = await api.get(`/market/fundamentals?symbol=${encodeURIComponent(symbol)}`);
  const d = (res.data?.data?.summaryDetail ?? {}) as Record<string, unknown>;
  const ks = (res.data?.data?.defaultKeyStatistics ?? {}) as Record<string, unknown>;
  const fd = (res.data?.data?.financialData ?? {}) as Record<string, unknown>;
  return {
    trailingPE: trailingPeFromModules(d, ks),
    forwardPE: rawNum(d.forwardPE),
    marketCap: rawNum(d.marketCap),
    dividendYield: rawNum(d.dividendYield),
    fiftyTwoWeekHigh: rawNum(d.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: rawNum(d.fiftyTwoWeekLow),
    beta: rawNum(d.beta),
    eps: rawNum(ks.trailingEps),
    debtToEquity: rawNum(ks.debtToEquity ?? fd.debtToEquity),
    returnOnEquity: rawNum(ks.returnOnEquity ?? fd.returnOnEquity),
  };
}

export function useMarketFundamentals(symbol: string | null) {
  const { data, isLoading, isError } = useQuery<Fundamentals>({
    queryKey: ["market", "fundamentals", symbol],
    queryFn: () => fetchFundamentals(symbol!),
    enabled: Boolean(symbol),
    staleTime: 300_000,
    retry: 1,
  });

  return { fundamentals: data ?? null, isLoading, isError };
}
