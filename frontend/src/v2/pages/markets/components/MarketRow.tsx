import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MarketStock } from "../../../hooks/useMarketExplorer";
import type { MarketDecisionAction } from "../sortMarketScan";
import { formatMarketPrice, marketExchangeLabel } from "../marketsFormat";
import { scannerSignalFromStock } from "../marketSignals";

export type MarketRowProps = {
  stock: MarketStock;
  decisionAction: MarketDecisionAction;
  active: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  expandContent?: ReactNode;
};

export default function MarketRow({
  stock,
  decisionAction,
  active,
  expanded,
  onSelect,
  onToggleExpand,
  expandContent,
}: MarketRowProps) {
  const sig = scannerSignalFromStock(stock);
  const chgCls = stock.changePercent >= 0 ? "market-feed__chg--up" : "market-feed__chg--down";
  const trendCls =
    stock.trend === "BULLISH"
      ? "market-feed__trend--bull"
      : stock.trend === "BEARISH"
        ? "market-feed__trend--bear"
        : "market-feed__trend--side";

  const posture = decisionAction.toLowerCase();

  return (
    <div
      className={`market-feed__group market-feed__group--${posture} ${active ? "market-feed__group--active" : ""}`}
    >
      <div
        className="market-feed__row"
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onSelect()}
      >
        <div className="market-feed__cell market-feed__cell--sym">
          <span className="market-feed__sym">{stock.symbol}</span>
          <span className="market-feed__exch">{marketExchangeLabel(stock.fullSymbol)}</span>
        </div>
        <div className="market-feed__cell market-feed__cell--price">
          {stock.pricePaise > 0 ? formatMarketPrice(stock.pricePaise, stock.isFallback) : "—"}
        </div>
        <div className={`market-feed__cell market-feed__cell--chg ${chgCls}`}>
          {stock.changePercent > 0 ? "+" : ""}
          {stock.changePercent.toFixed(2)}%
        </div>
        <div className={`market-feed__cell market-feed__cell--signal ${sig.cls}`}>{sig.label}</div>
        <div className={`market-feed__cell market-feed__cell--trend ${trendCls}`}>{stock.trend}</div>
        <button
          type="button"
          className="market-feed__expand"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-label={expanded ? "Collapse detail" : "Expand detail"}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>
      {expanded && expandContent ? <div className="market-feed__expand-body">{expandContent}</div> : null}
    </div>
  );
}
