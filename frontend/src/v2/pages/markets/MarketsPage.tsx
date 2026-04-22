import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import DecisionPanel from "../../features/trade/DecisionPanel";
import { useMarketExplorer, type MarketSegment, type MarketStock } from "../../hooks/useMarketExplorer";
import {
  buildMarketRowFromExplorerStock,
  tradePanelContextFromMarketRow,
  useMarketDecisions,
} from "../../hooks/useMarketDecisions";
import { setTradePanelOpener } from "../../trade-flow";
import type { TradePanelContext } from "../../trade-flow";
import MarketOpportunitiesHeader from "./components/MarketOpportunitiesHeader";
import OpportunityList from "./components/OpportunityList";
import DecisionDiscoveryPanel from "./components/DecisionDiscoveryPanel";
import { sortMarketScanFeed, marketStockDecisionAction } from "./sortMarketScan";

export default function MarketsPage() {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<MarketSegment>("all");
  const [selected, setSelected] = useState<MarketStock | null>(null);
  const [panel, setPanel] = useState<{ symbol: string; ctx: TradePanelContext } | null>(null);

  const { stocks, meta, isLoading, isFetching, isFetchingMore, isError, hasMore, loadMore } =
    useMarketExplorer(search, segment);
  const marketDecisions = useMarketDecisions();

  const sortedStocks = useMemo(() => sortMarketScanFeed(stocks), [stocks]);

  const validTradeCount = useMemo(
    () => sortedStocks.filter((s) => marketStockDecisionAction(s) === "ACT").length,
    [sortedStocks],
  );

  const isDegraded = Boolean(meta.isFallback || meta.isSynthetic);

  useEffect(() => {
    setTradePanelOpener((symbol, ctx) => setPanel({ symbol, ctx }));
    return () => setTradePanelOpener(null);
  }, []);

  useEffect(() => {
    if (!selected && sortedStocks.length > 0) setSelected(sortedStocks[0]);
  }, [sortedStocks, selected]);

  useEffect(() => {
    if (selected && !sortedStocks.some((s) => s.symbol === selected.symbol)) {
      setSelected(sortedStocks[0] ?? null);
    }
  }, [sortedStocks, selected]);

  useEffect(() => {
    if (!selected) return;
    const next = sortedStocks.find((s) => s.symbol === selected.symbol);
    if (next && next !== selected) setSelected(next);
  }, [sortedStocks, selected]);

  const openPanel = useCallback((stock: MarketStock) => {
    const row = buildMarketRowFromExplorerStock(stock);
    setPanel({
      symbol: row.fullSymbol,
      ctx: tradePanelContextFromMarketRow(row),
    });
  }, []);

  const handleSearchChange = useCallback((q: string) => {
    setSearch(q);
    setSelected(null);
  }, []);

  const handleSegmentChange = useCallback((next: MarketSegment) => {
    setSegment((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <AppLayout>
      <div className="markets-terminal flex min-h-0 flex-1 flex-col">
        {/* 60% list / 40% decision — bounded height so each column scrolls independently */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[3fr_2fr] lg:grid-rows-1 lg:h-[calc(100dvh-var(--topbar-height,52px)-2.5rem)]">
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-slate-800/80 lg:h-full lg:border-r">
            <MarketOpportunitiesHeader
              opportunityCount={sortedStocks.length}
              validTradeCount={validTradeCount}
              segment={segment}
              onSegmentChange={handleSegmentChange}
              search={search}
              onSearchChange={handleSearchChange}
              isFetching={isFetching}
              isLoading={isLoading}
              isDegraded={isDegraded}
            />
            {isError && (
              <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/25 bg-amber-500/5 px-4 py-2 text-sm text-amber-100">
                <AlertTriangle size={14} className="shrink-0" aria-hidden />
                Market data unavailable — retrying
              </div>
            )}
            <OpportunityList
              stocks={sortedStocks}
              selected={selected}
              onSelect={setSelected}
              isLoading={isLoading}
              search={search}
              hasMore={hasMore}
              isFetchingMore={isFetchingMore}
              loadMore={loadMore}
              marketDecisionItems={marketDecisions.items}
            />
          </div>

          <aside
            className={`flex min-h-0 min-w-0 flex-col overflow-hidden bg-slate-950/60 lg:sticky lg:top-0 lg:z-10 lg:h-full lg:self-start lg:border-l ${
              selected
                ? "border-cyan-500/40 shadow-[inset_4px_0_0_0_rgba(34,211,238,0.35)]"
                : "border-slate-800/80"
            }`}
          >
            {selected ? (
              <DecisionDiscoveryPanel
                selected={selected}
                marketDecisionItems={marketDecisions.items}
                onBuildTradePlan={() => openPanel(selected)}
              />
            ) : (
              <div className="flex min-h-[12rem] flex-1 items-center justify-center p-8 text-center text-sm leading-relaxed text-slate-500 lg:min-h-0">
                Select an opportunity to read the decision brief. Your next action stays here.
              </div>
            )}
          </aside>
        </div>
      </div>

      <DecisionPanel
        open={panel !== null}
        symbol={panel?.symbol ?? null}
        context={panel?.ctx ?? null}
        onClose={() => setPanel(null)}
        backdrop="markets"
      />
    </AppLayout>
  );
}
