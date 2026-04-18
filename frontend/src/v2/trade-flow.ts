import type { NavigateFunction } from "react-router-dom";
import type { Decision } from "./domain/decision/buildDecision";
import type { DecisionMeta } from "./components/decision/DecisionCard";
import { queryClient } from "../queryClient";
import { queryKeys } from "./queryKeys";

export type TradePanelContext = { decision: Decision; meta?: DecisionMeta; warnings: string[] };

type OpenFn = (symbol: string, context: TradePanelContext) => void;

let openFn: OpenFn | null = null;
let navigateFn: NavigateFunction | null = null;

/** Session flag read by Portfolio after SPA navigation (mirrors post-trade redirect). */
export const TRADE_SUCCESS_SESSION_KEY = "v2_trade_success";

export function setTradePanelOpener(fn: OpenFn | null): void {
  openFn = fn;
}

export function setTradeFlowNavigate(fn: NavigateFunction | null): void {
  navigateFn = fn;
}

export function openDecisionPanel(symbol: string, context: TradePanelContext): void {
  openFn?.(symbol, context);
}

export function confirmTradeAction(_symbol: string): void {
  sessionStorage.setItem(TRADE_SUCCESS_SESSION_KEY, "1");

  void Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary }),
    queryClient.invalidateQueries({ queryKey: queryKeys.journal }),
    queryClient.invalidateQueries({ queryKey: queryKeys.profile }),
    queryClient.invalidateQueries({ queryKey: queryKeys.trace }),
    queryClient.invalidateQueries({ queryKey: queryKeys.attention }),
    queryClient.invalidateQueries({ queryKey: queryKeys.markets }),
    queryClient.invalidateQueries({ queryKey: ["market", "technicals"] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.aiInsights }),
  ]).then(() => {
    if (navigateFn) {
      navigateFn("/portfolio", { replace: false });
    } else {
      window.location.href = "/portfolio"; // ROUTES.portfolio — keep string for non-React context
    }
  });
}
