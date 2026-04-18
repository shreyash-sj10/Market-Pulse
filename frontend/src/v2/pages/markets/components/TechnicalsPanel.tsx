import type { MarketStock } from "../../../hooks/useMarketExplorer";
import { useMarketTechnicals } from "../../../hooks/useMarketTechnicals";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-metric-row">
      <span className="workspace-metric-row__label">{label}</span>
      <span className="workspace-metric-row__value">{value}</span>
    </div>
  );
}

/** Tape-derived trend strength label (no synthetic numeric score). */
function trendStrengthFromTape(stock: MarketStock): string {
  const a = Math.abs(stock.changePercent);
  if (stock.trend === "BULLISH" && a >= 2) return "Strong bull impulse";
  if (stock.trend === "BEARISH" && a >= 2) return "Strong bear impulse";
  if (stock.trend === "BULLISH") return "Bull bias";
  if (stock.trend === "BEARISH") return "Bear bias";
  return "Range-bound";
}

export type TechnicalsPanelProps = {
  symbol: string;
  selected: MarketStock;
};

export default function TechnicalsPanel({ symbol, selected }: TechnicalsPanelProps) {
  const { technicals, isLoading, isError } = useMarketTechnicals(symbol);

  const rsiDisplay =
    isLoading ? "…" : isError ? "—" : technicals?.rsi14 != null ? String(technicals.rsi14) : "—";
  const emaDisplay =
    isLoading ? "…" : isError ? "—" : technicals?.ema200VsPrice === "above"
      ? "Above 200 EMA"
      : technicals?.ema200VsPrice === "below"
        ? "Below 200 EMA"
        : technicals?.sampleSize && technicals.sampleSize < 200
          ? "Insufficient history"
          : "—";
  const volDisplay =
    isLoading ? "…" : isError ? "—" : technicals?.volumeVsAvgLabel ?? "—";
  const trendStr = trendStrengthFromTape(selected);

  return (
    <div className="analysis-col">
      <p className="analysis-col__title">Technicals</p>
      <div className="workspace-metric-list">
        <Row label="RSI (14)" value={rsiDisplay} />
        <Row label="200 EMA" value={emaDisplay} />
        <Row label="Volume vs avg" value={volDisplay} />
        <Row label="Trend strength" value={trendStr} />
      </div>
      {technicals?.isDegraded && !isLoading && (
        <p className="workspace-flow-note workspace-flow-note--muted">
          Limited history — technicals indicative only.
        </p>
      )}
    </div>
  );
}
