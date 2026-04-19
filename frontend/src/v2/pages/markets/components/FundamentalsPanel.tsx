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

function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
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

  const sectorDisplay =
    isLoading ? "…" : fundamentals?.sector?.trim() ? fundamentals.sector.trim() : "—";

  const stockPct = selected.changePercent;
  const sectorPct = fundamentals?.sectorChangePercent;
  const showRelative =
    !isLoading &&
    !isError &&
    fundamentals?.sector != null &&
    sectorPct != null &&
    Number.isFinite(sectorPct) &&
    fundamentals.sectorBenchmarkLabel != null;

  const delta = showRelative ? stockPct - sectorPct : null;

  return (
    <div className="analysis-col">
      <p className="analysis-col__title">Fundamentals</p>
      <div className="workspace-metric-list">
        <Row label="Sector" value={sectorDisplay} />
        <Row label="P/E" value={peDisplay} />
        <Row label="ROE" value={roeDisplay} />
        <Row label="Debt / equity" value={debtEqDisplay} />
        <Row label="EPS" value={epsDisplay} />
      </div>

      {showRelative && delta != null ? (
        <div className="workspace-relative">
          <p className="workspace-relative__title">Relative performance</p>
          <p className="workspace-relative__hint">{fundamentals.sectorBenchmarkLabel}</p>
          <div className="workspace-relative__grid">
            <span className="workspace-relative__k">Stock</span>
            <span className={`workspace-relative__v ${stockPct >= 0 ? "workspace-change--up" : "workspace-change--down"}`}>
              {fmtPct(stockPct)}
            </span>
            <span className="workspace-relative__k">Sector</span>
            <span className={`workspace-relative__v ${sectorPct >= 0 ? "workspace-change--up" : "workspace-change--down"}`}>
              {fmtPct(sectorPct)}
            </span>
            <span className="workspace-relative__k">Δ vs sector</span>
            <span className={`workspace-relative__v ${delta >= 0 ? "workspace-change--up" : "workspace-change--down"}`}>
              {fmtPct(delta)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
