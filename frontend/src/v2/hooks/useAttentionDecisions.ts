/**
 * useAttentionDecisions — home "attention" rail: **portfolio only**.
 *
 * Market scanner symbols must never appear here as fake "positions needing review".
 * If you have no open holdings, this list is empty even when the market is moving.
 *
 * Source: `/portfolio/positions` via fetchPortfolioData → buildDecision.
 */
import { useQuery } from "@tanstack/react-query";
import type { DecisionCardProps } from "../components/decision/DecisionCard";
import { buildDecision } from "../domain/decision/buildDecision";
import type { BuildDecisionInput } from "../domain/decision/buildDecision";
import { fetchPortfolioData } from "../data/portfolioData";
import type { DecisionListStatus } from "../types/decisionUi";
import { openDecisionPanel } from "../trade-flow";
import { queryKeys } from "../queryKeys";

type Row = BuildDecisionInput & { symbol: string; pnlPct?: number; quantity?: number; changePct?: number };

function isUrgent(confidence: number, action: "ACT" | "GUIDE" | "BLOCK"): boolean {
  if (action === "BLOCK" || action === "GUIDE") return true;
  return action === "ACT" && confidence < 72;
}

function rowsToDecisionItems(rows: Row[]): DecisionCardProps[] {
  const seen = new Set<string>();
  const merged: Row[] = [];
  for (const r of rows) {
    if (seen.has(r.symbol)) continue;
    seen.add(r.symbol);
    merged.push(r);
  }

  const withDecisions = merged.map((r) => ({ row: r, decision: buildDecision(r) }));
  const urgent = withDecisions.filter(({ decision }) => isUrgent(decision.confidence, decision.action));
  const source = urgent.length ? urgent : withDecisions.slice(0, 5);

  return source.map(({ row, decision }) => ({
    title: row.symbol,
    decision,
    meta: {
      ...(row.pnlPct   !== undefined ? { pnlPct: row.pnlPct }     : {}),
      ...(row.quantity  !== undefined ? { quantity: row.quantity }  : {}),
      ...(row.changePct !== undefined ? { changePct: row.changePct }: {}),
    },
    onPrimaryAction: () =>
      openDecisionPanel(row.symbol, { decision, meta: {}, warnings: [] }),
  }));
}

async function loadAttention(): Promise<DecisionListStatus> {
  let isDegraded = false;
  let isError    = false;

  const portfolioRows: Row[] = [];
  try {
    const p = await fetchPortfolioData();
    isDegraded = isDegraded || p.degraded;
    isError    = isError    || p.fetchFailed;
    portfolioRows.push(...p.rows.map((row) => ({ ...row } as Row)));
  } catch {
    isDegraded = true;
    isError    = true;
  }

  return {
    items:      rowsToDecisionItems(portfolioRows),
    source:     isDegraded ? "fallback" : "api",
    isLoading:  false,
    isError,
    isDegraded,
  };
}

export function useAttentionDecisions(): DecisionListStatus {
  const q = useQuery({
    queryKey: queryKeys.attention,
    queryFn: loadAttention,
    staleTime: 0,
  });

  if (q.isPending && !q.data) {
    return { items: [], source: "api", isLoading: true, isError: false, isDegraded: false };
  }

  return q.data ?? { items: [], source: "fallback", isLoading: false, isError: true, isDegraded: false };
}
