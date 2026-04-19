import { useMemo } from "react";
import { useMarketNews } from "./useMarketNews";
import { deriveNewsIntelligenceView } from "../intelligence/symbolIntelligenceModel";

/**
 * Canonical news intelligence for a symbol — same query + derivation as Markets `IntelligenceBlock`.
 * Use in the trade terminal so validation UX is not a second, divergent narrative.
 */
export function useSymbolIntelligence(symbol: string | null) {
  const sym = symbol && symbol.trim() ? symbol.trim() : undefined;
  const { signals, isLoading, isError } = useMarketNews(sym);

  const view = useMemo(() => deriveNewsIntelligenceView(signals), [signals]);

  return {
    signals,
    bullets: view.bullets,
    sentiment: view.sentiment,
    isLoading,
    isError,
  };
}
