import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";

export interface ClosedTrade {
  tradeId:     string;
  symbol:      string;
  side:        string;
  quantity:    number;
  pricePaise:  number;
  pnlPaise:    number | null;
  pnlPct:      number | null;
  verdict:     string | null;
  closedAt:    string | null;
  reflection?: string | null;
  /** Self-reported mood on the opening leg, when stored. */
  preTradeEmotionAtEntry?: string | null;
}

function closedAtToIso(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v).toISOString();
  const s = String(v);
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : s;
}

/** Journal `/summary` entries are already closed round-trips — do not filter on legacy SELL fields. */
async function fetchClosedTrades(): Promise<ClosedTrade[]> {
  const res = await api.get("/journal/summary");
  const payload = res.data?.data ?? res.data ?? {};
  const entries: Record<string, unknown>[] = Array.isArray(payload.entries)
    ? payload.entries
    : Array.isArray(payload)
      ? payload
      : [];

  const ls = (e: Record<string, unknown>) => (e.learningSurface as Record<string, unknown> | undefined) ?? {};

  return entries.slice(0, 50).map((e): ClosedTrade => {
    const actual = e.actual as Record<string, unknown> | undefined;
    const exitPaise = Number(e.exitPricePaise ?? actual?.exitPaise ?? 0);
    const surface = ls(e);
    const mood = e.preTradeEmotionAtEntry;
    return {
      tradeId: String(e.tradeId ?? `${e.symbol}-${e.closedAt}`),
      symbol: String(e.symbol ?? ""),
      side: String(e.side ?? "SELL"),
      quantity: Number(e.quantity ?? 0),
      pricePaise: exitPaise,
      pnlPaise: e.pnlPaise != null ? Number(e.pnlPaise) : null,
      pnlPct: e.pnlPct != null ? Number(e.pnlPct) : null,
      preTradeEmotionAtEntry:
        mood != null && String(mood).trim() ? String(mood).trim().toUpperCase() : null,
      verdict:
        e.verdict != null
          ? String(e.verdict)
          : surface.verdict != null
            ? String(surface.verdict)
            : null,
      closedAt: closedAtToIso(e.closedAt),
      reflection:
        e.reflection != null
          ? String(e.reflection)
          : surface.insight != null
            ? String(surface.insight)
            : null,
    };
  });
}

export function useClosedPositions() {
  const { data, isLoading, isError } = useQuery<ClosedTrade[]>({
    queryKey:  ["journal", "closed"],
    queryFn:   fetchClosedTrades,
    staleTime: 60_000,
    retry:     1,
  });

  return {
    trades:    data ?? [],
    isLoading,
    isError,
  };
}
