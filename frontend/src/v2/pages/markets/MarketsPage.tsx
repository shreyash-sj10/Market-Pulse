import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, AlertTriangle } from "lucide-react";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import DecisionPanel from "../../features/trade/DecisionPanel";
import { useMarketExplorer, type MarketSegment } from "../../hooks/useMarketExplorer";
import {
  buildMarketRowFromExplorerStock,
  tradePanelContextFromMarketRow,
  useMarketDecisions,
} from "../../hooks/useMarketDecisions";
import { setTradePanelOpener } from "../../trade-flow";
import type { TradePanelContext } from "../../trade-flow";
import type { MarketStock } from "../../hooks/useMarketExplorer";
import MarketList from "./components/MarketList";
import DecisionWorkspace from "./components/DecisionWorkspace";
import { sortMarketScanFeed } from "./sortMarketScan";

const SEGMENT_OPTIONS: { id: MarketSegment; label: string }[] = [
  { id: "all", label: "All" },
  { id: "large", label: "Large cap" },
  { id: "mid", label: "Mid cap" },
  { id: "small", label: "Small cap" },
];

export default function MarketsPage() {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<MarketSegment>("all");
  const [selected, setSelected] = useState<MarketStock | null>(null);
  const [panel, setPanel] = useState<{ symbol: string; ctx: TradePanelContext } | null>(null);

  const { stocks, meta, isLoading, isFetching, isFetchingMore, isError, hasMore, loadMore } =
    useMarketExplorer(search, segment);
  const marketDecisions = useMarketDecisions();

  const sortedStocks = useMemo(() => sortMarketScanFeed(stocks), [stocks]);

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

  return (
    <AppLayout>
      <div className="markets-terminal">
        <div className="markets-terminal__grid" data-linked={selected ? "1" : "0"}>
          <div className="markets-terminal__scan markets-scanner">
            <div className="markets-scanner__toolbar">
              <span className="markets-scanner__title">
                Scanner
                {meta.isFallback && <span className="markets-scanner__badge">FALLBACK</span>}
                {(isFetchingMore || (isFetching && !isLoading)) && (
                  <RefreshCw size={10} className="markets-scanner__spinner" aria-hidden />
                )}
              </span>
              <div className="markets-scanner__toolbar-tail">
                <div className="scanner-segment" role="group" aria-label="Market cap segment">
                  {SEGMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`scanner-segment__pill ${segment === opt.id ? "scanner-segment__pill--active" : ""}`}
                      onClick={() => {
                        if (opt.id === segment) return;
                        setSegment(opt.id);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="scanner-search">
                  <Search className="scanner-search__icon" size={12} aria-hidden />
                  <input
                    type="text"
                    className="scanner-search__input"
                    placeholder="Search symbols…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelected(null);
                    }}
                  />
                </div>
              </div>
            </div>

            {isError && (
              <div className="degraded-banner">
                <AlertTriangle size={11} aria-hidden /> Market data unavailable — retrying
              </div>
            )}

            <MarketList
              stocks={sortedStocks}
              selected={selected}
              onSelect={setSelected}
              isLoading={isLoading}
              search={search}
              hasMore={hasMore}
              isFetchingMore={isFetchingMore}
              loadMore={loadMore}
            />

            <div className="scanner-footer">
              <span className="scanner-footer__text">{sortedStocks.length} instruments loaded</span>
              <span className="scanner-footer__text">{meta.isSynthetic ? "SYNTHETIC DATA" : "LIVE DATA"}</span>
            </div>
          </div>

          <div className="markets-terminal__side">
            {selected ? (
              <DecisionWorkspace
                selected={selected}
                marketDecisionItems={marketDecisions.items}
                onOpenTradePanel={() => openPanel(selected)}
              />
            ) : (
              <div className="markets-terminal__empty">Select a symbol from the scanner to view analysis.</div>
            )}
          </div>
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
