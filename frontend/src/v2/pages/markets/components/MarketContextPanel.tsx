import { useSymbolIntelligence } from "../../../hooks/useSymbolIntelligence";
import {
  newsSentimentUiLabel,
  softenScannerLanguage,
} from "../marketsDisplayCopy";
import type { IntelligenceBias } from "../mapIntelligenceItems";

function BiasPill({ bias }: { bias: IntelligenceBias | "Mixed" }) {
  const show = newsSentimentUiLabel(bias);
  const cls =
    show === "Uptrend"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : show === "Downtrend"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
        : "border-slate-600 bg-slate-800/80 text-slate-200";
  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${cls}`}>{show}</span>;
}

export type MarketContextPanelProps = {
  symbol: string;
};

/** News-driven market context; mirrors IntelligenceBlock data — Tailwind surface only. */
export default function MarketContextPanel({ symbol }: MarketContextPanelProps) {
  const { bullets, sentiment, isLoading, isError } = useSymbolIntelligence(symbol);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Preparing your workspace</p>;
  }

  const bias: IntelligenceBias | "Mixed" = isError ? "Neutral" : sentiment;
  const lines = bullets.length > 0 ? bullets : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Headline tone</p>
        <BiasPill bias={bias} />
      </div>
      {lines.length > 0 ? (
        <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-slate-300">
          {lines.map((line, i) => (
            <li key={`${i}-${line.slice(0, 32)}`}>{softenScannerLanguage(line)}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed text-slate-500">
          No headline stream yet — use tape and fundamentals before sizing.{" "}
          {isError ? "News feed is unavailable; rely on the analysis blocks." : ""}
        </p>
      )}
    </div>
  );
}
