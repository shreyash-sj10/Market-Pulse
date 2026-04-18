import { useQuery } from "@tanstack/react-query";
import type { DecisionCardProps } from "../../components/decision/DecisionCard";
import { buildDecision } from "../../domain/decision/buildDecision";
import type { DecisionListStatus } from "../../types/decisionUi";
import { queryKeys } from "../../queryKeys";
import {
  fetchPortfolioWithAccountSummary,
  type PortfolioPosition,
} from "../../data/portfolioData";
import { openDecisionPanel } from "../../trade-flow";

function mapRowsToItems(rows: PortfolioPosition[]): DecisionCardProps[] {
  return rows.map((p) => {
    const decision = buildDecision(p);
    return {
      title:           p.symbol,
      decision,
      meta:            {
        pnlPct: p.pnlPct,
        quantity: p.quantity,
        avgPricePaise: p.avgPricePaise,
      },
      onPrimaryAction: () =>
        openDecisionPanel(p.symbol, {
          decision,
          meta: { pnlPct: p.pnlPct, quantity: p.quantity, side: "SELL" },
          warnings: [],
        }),
    };
  });
}

async function loadPortfolio(): Promise<DecisionListStatus> {
  const {
    rows,
    positionsDegraded,
    positionsFailed,
    accountSummary,
    summaryFailed,
  } = await fetchPortfolioWithAccountSummary();
  return {
    items: mapRowsToItems(rows),
    source: positionsDegraded || positionsFailed ? "fallback" : "api",
    isLoading: false,
    isError: positionsFailed,
    isDegraded: positionsDegraded,
    accountSummary,
    summaryFetchFailed: summaryFailed,
  };
}

export function usePortfolioDecisions(): DecisionListStatus {
  const q = useQuery({
    queryKey: queryKeys.portfolio,
    queryFn:  loadPortfolio,
    staleTime: 0,
  });

  if (q.isPending && !q.data) {
    return {
      items: [],
      source: "api",
      isLoading: true,
      isError: false,
      isDegraded: false,
      accountSummary: null,
      summaryFetchFailed: false,
    };
  }

  return (
    q.data ?? {
      items: [],
      source: "fallback",
      isLoading: false,
      isError: true,
      isDegraded: false,
      accountSummary: null,
      summaryFetchFailed: true,
    }
  );
}

export type { PortfolioPosition } from "../../data/portfolioData";
