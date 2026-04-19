import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import type { MarketStock } from "../../../hooks/useMarketExplorer";
import { marketStockDecisionAction } from "../sortMarketScan";
import MarketRow from "./MarketRow";

export type MarketListProps = {
  stocks: MarketStock[];
  selected: MarketStock | null;
  onSelect: (stock: MarketStock) => void;
  isLoading: boolean;
  search: string;
  hasMore: boolean;
  isFetchingMore: boolean;
  loadMore: () => void;
};

export default function MarketList({
  stocks,
  selected,
  onSelect,
  isLoading,
  search,
  hasMore,
  isFetchingMore,
  loadMore,
}: MarketListProps) {
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
    <div className="market-feed" aria-label="Market scanner">
      <div className="market-feed__header">
        <span>Symbol</span>
        <span>Price</span>
        <span>Chg %</span>
        <span>Signal</span>
        <span>Trend</span>
      </div>

      <div ref={bodyRef} className="market-feed__body">
        {isLoading ? (
          <p className="market-feed__note page-loading page-note">Loading market data…</p>
        ) : stocks.length === 0 ? (
          <p className="market-feed__note page-note">No symbols match &quot;{search}&quot;.</p>
        ) : (
          stocks.map((stock) => (
            <MarketRow
              key={stock.fullSymbol ?? stock.symbol}
              stock={stock}
              decisionAction={marketStockDecisionAction(stock)}
              active={selected?.symbol === stock.symbol}
              onSelect={() => onSelect(stock)}
            />
          ))
        )}

        {hasMore && (
          <div ref={sentinelRef} className="market-feed__sentinel">
            {isFetchingMore && <RefreshCw size={14} className="scanner-sentinel__spin" aria-hidden />}
          </div>
        )}
      </div>
    </div>
  );
}
