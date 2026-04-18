/**
 * useMarketDecisions — fetches real market stocks from /market/explore
 * and maps them to attention-ready decision items.
 *
 * All fields derived from real API data (pricePaise, changePercent, trend).
 * No hash-based synthesis, no mock data.
 */
import { useQuery } from "@tanstack/react-query";
import api from "../api/api.js";
import type { DecisionCardProps } from "../components/decision/DecisionCard";
import { buildDecision } from "../domain/decision/buildDecision";
import type { BuildDecisionInput } from "../domain/decision/buildDecision";
import { openDecisionPanel } from "../trade-flow";
import type { TradePanelContext } from "../trade-flow";
import type { DecisionListStatus } from "../types/decisionUi";
import { queryKeys } from "../queryKeys";
import type { MarketStock } from "./useMarketExplorer";

export type MarketRow = BuildDecisionInput & {
  symbol: string;
  changePct: number;
  /** Full symbol for trade panel / APIs */
  fullSymbol: string;
};

function toWarningsList(w?: boolean | string[]): string[] {
  if (Array.isArray(w)) return w;
  if (w) return ["Review required"];
  return [];
}

/** Same mapping as explore rows — shared with Markets workspace. */
export function buildMarketRowFromExplorerStock(stock: MarketStock): MarketRow {
  const changePercent = stock.changePercent;
  const trend = stock.trend;
  const riskScore = Math.min(100, Math.max(10, Math.round(50 + Math.abs(changePercent) * 5)));
  const allowed = trend !== "BEARISH" || changePercent > -2;
  const warnings: string[] | false =
    trend === "BEARISH" ? ["Bearish trend"] : changePercent < -1.5 ? ["Significant decline"] : false;

  return {
    symbol: stock.symbol,
    fullSymbol: stock.fullSymbol ?? stock.symbol,
    changePct: changePercent,
    allowed,
    riskScore,
    warnings,
    fallback: Boolean(stock.isFallback || stock.isSynthetic),
  };
}

function buildMarketRowFromApiRecord(
  stock: Record<string, unknown>,
  responseDegraded: boolean,
): MarketRow {
  const changePercent = Number(stock.changePercent ?? 0);
  const trend = String(stock.trend ?? "SIDEWAYS");
  const riskScore = Math.min(100, Math.max(10, Math.round(50 + Math.abs(changePercent) * 5)));
  const allowed = trend !== "BEARISH" || changePercent > -2;
  const warnings: string[] | false =
    trend === "BEARISH" ? ["Bearish trend"] : changePercent < -1.5 ? ["Significant decline"] : false;
  const rowFallback = Boolean(stock.isFallback ?? stock.isSynthetic);

  return {
    symbol: String(stock.symbol ?? ""),
    fullSymbol: String(stock.fullSymbol ?? stock.symbol ?? ""),
    changePct: changePercent,
    allowed,
    riskScore,
    warnings,
    fallback: rowFallback || responseDegraded,
  };
}

export function tradePanelContextFromMarketRow(row: MarketRow): TradePanelContext {
  const decision = buildDecision(row);
  return {
    decision,
    meta: { changePct: row.changePct },
    warnings: toWarningsList(row.warnings),
  };
}

function mapRowToItem(p: MarketRow): DecisionCardProps {
  const decision = buildDecision(p);
  const meta = { changePct: p.changePct };
  const warnings = toWarningsList(p.warnings);
  return {
    title: p.symbol,
    decision,
    meta,
    onPrimaryAction: () =>
      openDecisionPanel(p.fullSymbol, {
        decision,
        meta,
        warnings,
      }),
  };
}

/**
 * Decision card for a scanner row — identical pipeline to `useMarketDecisions` row mapping.
 */
export function marketExplorerStockToDecisionCard(stock: MarketStock): DecisionCardProps {
  return mapRowToItem(buildMarketRowFromExplorerStock(stock));
}

/**
 * Prefer hook item when this symbol is in the preloaded slice; otherwise derive from explorer row.
 */
export function resolveMarketDecisionCard(
  stock: MarketStock,
  hookItems: DecisionCardProps[],
): DecisionCardProps {
  const match = hookItems.find((i) => i.title === stock.symbol);
  if (match) return match;
  return marketExplorerStockToDecisionCard(stock);
}

/**
 * Fetch a small slice of market stocks from the real explore endpoint.
 * Used by useAttentionDecisions (market-level attention) and query cache for markets.
 */
export async function fetchMarketData(): Promise<{ rows: MarketRow[]; degraded: boolean }> {
  try {
    const res = await api.get("/market/explore?limit=6&offset=0");
    const stocks: Record<string, unknown>[] = res.data?.stocks ?? [];

    if (!stocks.length) {
      return { rows: [], degraded: Boolean(res.data?.meta?.isFallback) };
    }

    const isFallback = Boolean(res.data?.meta?.isFallback ?? res.data?.meta?.isSynthetic);

    const rows: MarketRow[] = stocks
      .slice(0, 4)
      .map((stock) => buildMarketRowFromApiRecord(stock, isFallback));

    return { rows, degraded: isFallback };
  } catch {
    return { rows: [], degraded: true };
  }
}

function mapRowsToItems(rows: MarketRow[]): DecisionCardProps[] {
  return rows.map(mapRowToItem);
}

async function loadMarket(): Promise<DecisionListStatus> {
  const { rows, degraded } = await fetchMarketData();
  return {
    items: mapRowsToItems(rows),
    source: degraded ? "fallback" : "api",
    isLoading: false,
    isError: false,
    isDegraded: degraded,
  };
}

export function useMarketDecisions(): DecisionListStatus {
  const q = useQuery({
    queryKey: queryKeys.markets,
    queryFn: loadMarket,
    staleTime: 30_000,
  });

  if (q.isPending && !q.data) {
    return { items: [], source: "api", isLoading: true, isError: false, isDegraded: false };
  }

  return q.data ?? { items: [], source: "fallback", isLoading: false, isError: true, isDegraded: false };
}
