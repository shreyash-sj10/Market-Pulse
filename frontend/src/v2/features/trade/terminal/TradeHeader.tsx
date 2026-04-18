import type { Decision } from "../../../domain/decision/buildDecision";

export type TradeHeaderProps = {
  symbol: string;
  /** Display price (₹ string, already formatted). */
  priceDisplay: string;
  changePct: number | null;
  signal: Decision["action"];
  /** Optional subtitle e.g. exchange */
  subline?: string;
};

function signalClass(s: Decision["action"]): string {
  return s === "ACT" ? "trade-terminal-signal trade-terminal-signal--act" : "trade-terminal-signal";
}

export default function TradeHeader({ symbol, priceDisplay, changePct, signal, subline }: TradeHeaderProps) {
  const chg =
    changePct == null || !Number.isFinite(changePct)
      ? "—"
      : `${changePct > 0 ? "+" : ""}${changePct.toFixed(2)}%`;
  const chgCls = "trade-terminal-header__chg";

  return (
    <header className="trade-terminal-header">
      <div className="trade-terminal-header__row">
        <h2 id="trade-terminal-title" className="trade-terminal-header__symbol">
          {symbol}
        </h2>
        <span className={signalClass(signal)}>{signal}</span>
      </div>
      {subline ? <p className="trade-terminal-header__sub">{subline}</p> : null}
      <div className="trade-terminal-header__metrics">
        <div className="trade-terminal-header__metric">
          <span className="trade-terminal-header__metric-label">Price</span>
          <span className="trade-terminal-header__metric-value">{priceDisplay}</span>
        </div>
        <div className="trade-terminal-header__metric">
          <span className="trade-terminal-header__metric-label">Chg</span>
          <span className={chgCls}>{chg}</span>
        </div>
      </div>
    </header>
  );
}
