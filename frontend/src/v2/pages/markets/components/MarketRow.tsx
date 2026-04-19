import type { MarketStock } from "../../../hooks/useMarketExplorer";
import type { MarketDecisionAction } from "../sortMarketScan";
import { formatMarketPrice, marketExchangeLabel } from "../marketsFormat";
import { scannerSignalFromStock } from "../marketSignals";

export type MarketRowProps = {
  stock: MarketStock;
  decisionAction: MarketDecisionAction;
  active: boolean;
  onSelect: () => void;
};

export default function MarketRow({ stock, decisionAction, active, onSelect }: MarketRowProps) {
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
        <div className="market-feed__cell market-feed__cell--signal">
          <span className={`scanner-signal-tag ${sig.cls}`}>{sig.action}</span>
        </div>
        <div className={`market-feed__cell market-feed__cell--trend ${trendCls}`}>{stock.trend}</div>
      </div>
    </div>
  );
}
