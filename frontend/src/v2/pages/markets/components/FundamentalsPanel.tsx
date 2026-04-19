import type { MarketStock } from "../../../hooks/useMarketExplorer";
import { useMarketFundamentals } from "../../../hooks/useMarketFundamentals";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-metric-row">
      <span className="workspace-metric-row__label">{label}</span>
      <span className="workspace-metric-row__value">{value}</span>
    </div>
  );
}

function formatRoeDisplay(roe: number | null): string {
  if (roe == null || !Number.isFinite(roe)) return "—";
  const pct = Math.abs(roe) <= 1 ? roe * 100 : roe;
  return `${pct.toFixed(1)}%`;
}

export type FundamentalsPanelProps = {
  symbol: string;
  selected: MarketStock;
};

export default function FundamentalsPanel({ symbol, selected }: FundamentalsPanelProps) {
  const { fundamentals, isLoading, isError } = useMarketFundamentals(symbol);

  const peDisplay =
    fundamentals?.trailingPE != null
      ? fundamentals.trailingPE.toFixed(1)
      : selected.peRatio != null
        ? selected.peRatio.toFixed(1)
        : "—";
  const debtEqDisplay =
    isLoading ? "…" : isError ? "—" : fundamentals?.debtToEquity != null ? fundamentals.debtToEquity.toFixed(2) : "—";
  const roeDisplay = isLoading ? "…" : isError ? "—" : formatRoeDisplay(fundamentals?.returnOnEquity ?? null);
  const epsDisplay =
    isLoading ? "…" : isError ? "—" : fundamentals?.eps != null ? `₹${fundamentals.eps.toFixed(2)}` : "—";

  return (
    <div className="analysis-col">
      <p className="analysis-col__title">Fundamentals</p>
      <div className="workspace-metric-list">
        <Row label="P/E" value={peDisplay} />
        <Row label="ROE" value={roeDisplay} />
        <Row label="Debt / equity" value={debtEqDisplay} />
        <Row label="EPS" value={epsDisplay} />
      </div>
    </div>
  );
}
