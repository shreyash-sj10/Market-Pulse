import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import type { MarketStock } from "../../../hooks/useMarketExplorer";
import type { DecisionCardProps } from "../../../components/decision/DecisionCard";
import { resolveMarketDecisionCard } from "../../../hooks/useMarketDecisions";
import OpportunityRow from "./OpportunityRow";

export type OpportunityListProps = {
  stocks: MarketStock[];
  selected: MarketStock | null;
  onSelect: (stock: MarketStock) => void;
  isLoading: boolean;
  search: string;
  hasMore: boolean;
  isFetchingMore: boolean;
  loadMore: () => void;
  marketDecisionItems: DecisionCardProps[];
};

export default function OpportunityList({
  stocks,
  selected,
  onSelect,
  isLoading,
  search,
  hasMore,
  isFetchingMore,
  loadMore,
  marketDecisionItems,
}: OpportunityListProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = bodyRef.current;
    const sentinel = sentinelRef.current;
    if (!hasMore || !root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingMore) loadMore();
      },
      { root, rootMargin: "160px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, loadMore]);

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      aria-label="Ranked opportunities"
    >
      <div
        ref={bodyRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-2 py-4 md:px-3"
      >
        {isLoading ? (
          <p className="px-1 py-4 text-sm text-slate-500">Preparing your workspace</p>
        ) : stocks.length === 0 ? (
          <p className="px-1 py-4 text-sm text-slate-500">No symbols match {search ? `“${search}”` : "this filter"}.</p>
        ) : (
          stocks.map((stock, i) => {
            const card = resolveMarketDecisionCard(stock, marketDecisionItems);
            return (
              <OpportunityRow
                key={stock.fullSymbol ?? stock.symbol}
                stock={stock}
                card={card}
                rank={i + 1}
                active={selected?.symbol === stock.symbol}
                onSelect={() => onSelect(stock)}
              />
            );
          })
        )}

        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-3">
            {isFetchingMore && <RefreshCw size={16} className="animate-spin text-cyan-500" aria-hidden />}
          </div>
        )}
      </div>
    </div>
  );
}
