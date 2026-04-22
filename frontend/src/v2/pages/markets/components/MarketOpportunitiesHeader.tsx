import { Search, RefreshCw } from "lucide-react";
import type { MarketSegment } from "../../../hooks/useMarketExplorer";

const SEGMENT_OPTIONS: { id: MarketSegment; label: string }[] = [
  { id: "all", label: "All" },
  { id: "large", label: "Large cap" },
  { id: "mid", label: "Mid cap" },
  { id: "small", label: "Small cap" },
];

export type MarketOpportunitiesHeaderProps = {
  opportunityCount: number;
  validTradeCount: number;
  segment: MarketSegment;
  onSegmentChange: (s: MarketSegment) => void;
  search: string;
  onSearchChange: (q: string) => void;
  isFetching: boolean;
  isLoading: boolean;
  isDegraded: boolean;
};

function segmentContextLabel(segment: MarketSegment): string {
  return SEGMENT_OPTIONS.find((o) => o.id === segment)?.label ?? "All";
}

export default function MarketOpportunitiesHeader({
  opportunityCount,
  validTradeCount,
  segment,
  onSegmentChange,
  search,
  onSearchChange,
  isFetching,
  isLoading,
  isDegraded,
}: MarketOpportunitiesHeaderProps) {
  const filterParts = [segmentContextLabel(segment)];
  if (search.trim()) filterParts.push(`“${search.trim()}”`);
  const filterLine = filterParts.join(" · ");

  return (
    <header className="shrink-0 space-y-4 border-b border-slate-800/80 bg-slate-950/50 px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold tracking-wide text-slate-100 md:text-lg">MARKET OPPORTUNITIES</h1>
            {isDegraded && (
              <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-200">
                Best-effort data
              </span>
            )}
            {isFetching && !isLoading && <RefreshCw size={14} className="shrink-0 animate-spin text-cyan-400" aria-hidden />}
          </div>
          <p className="text-sm text-slate-500">
            <span className="text-slate-300">{opportunityCount} opportunities</span>
            <span className="text-slate-600"> · </span>
            <span className="text-emerald-300/90">{validTradeCount} valid trades</span>
            <span className="text-slate-600"> · </span>
            <span title="Filter context">{filterLine}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Market cap segment">
          {SEGMENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSegmentChange(opt.id)}
              className={`min-h-9 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                segment === opt.id
                  ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-200"
                  : "border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-600 hover:text-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative w-full min-w-0 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter symbols"
            className="w-full min-h-10 rounded-lg border border-slate-800 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            aria-label="Filter symbols"
          />
        </div>
      </div>
    </header>
  );
}
