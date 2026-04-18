import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, AlertTriangle } from "lucide-react";
import AppLayout from "../../layout/AppLayout/AppLayout.jsx";
import DecisionPanel from "../../features/trade/DecisionPanel";
import { useMarketExplorer, type MarketSegment } from "../../hooks/useMarketExplorer";
import { useMarketFundamentals } from "../../hooks/useMarketFundamentals";
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

function InlineFundamentals({ symbol }: { symbol: string }) {
  const { fundamentals, isLoading, isError } = useMarketFundamentals(symbol);

  if (isLoading) {
    return (
      <div className="inline-fund-row">
        <span className="inline-fund__item inline-fund__item--muted">Loading fundamentals…</span>
      </div>
    );
  }

  if (isError || !fundamentals) {
    return (
      <div className="inline-fund-row">
        <span className="inline-fund__item inline-fund__item--error">
          <AlertTriangle size={10} className="inline-fund__warn-icon" aria-hidden />
          Fundamental data unavailable
        </span>
      </div>
    );
  }

  const items = [
    { label: "EPS", value: fundamentals.eps != null ? `₹${fundamentals.eps.toFixed(2)}` : "—" },
    {
      label: "Div Yield",
      value: fundamentals.dividendYield != null ? `${(fundamentals.dividendYield * 100).toFixed(2)}%` : "—",
    },
    { label: "Beta", value: fundamentals.beta != null ? fundamentals.beta.toFixed(2) : "—" },
    {
      label: "52W High",
      value: fundamentals.fiftyTwoWeekHigh != null ? `₹${fundamentals.fiftyTwoWeekHigh.toFixed(2)}` : "—",
    },
    {
      label: "52W Low",
      value: fundamentals.fiftyTwoWeekLow != null ? `₹${fundamentals.fiftyTwoWeekLow.toFixed(2)}` : "—",
    },
    {
      label: "Fwd P/E",
      value: fundamentals.forwardPE != null ? fundamentals.forwardPE.toFixed(1) : "—",
    },
  ];

  return (
    <div className="inline-fund-row">
      {items.map((item) => (
        <div key={item.label} className="inline-fund__item">
          <span className="inline-fund__label">{item.label}</span>
          <span className="inline-fund__value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function MarketsPage() {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<MarketSegment>("all");
  const [selected, setSelected] = useState<MarketStock | null>(null);
  const [panel, setPanel] = useState<{ symbol: string; ctx: TradePanelContext } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const toggleExpand = useCallback((symbol: string) => {
    setExpanded((prev) => (prev === symbol ? null : symbol));
  }, []);

  const renderExpand = useCallback(
    (stock: MarketStock) => <InlineFundamentals symbol={stock.fullSymbol ?? stock.symbol} />,
    [],
  );

  return (
    <AppLayout>
      <div className="markets-terminal">
        <div className="markets-terminal__grid" data-linked={selected ? "1" : "0"}>
          <div className="markets-terminal__scan markets-scanner">
            <div className="markets-scanner__toolbar">
              <span className="markets-scanner__title">
                Market Scanner
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
                        setExpanded(null);
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
                      setExpanded(null);
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
              expandedSymbol={expanded}
              onToggleExpand={toggleExpand}
              renderExpand={renderExpand}
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
