import type { Decision } from "../../../domain/decision/buildDecision";

export type HomeAttentionCardProps = {
  tag: Decision["action"];
  symbol: string;
  reason: string;
  confidence: number;
  ctaLabel: string;
  onAction: () => void;
};

export default function AttentionCard({
  tag,
  symbol,
  reason,
  confidence,
  ctaLabel,
  onAction,
}: HomeAttentionCardProps) {
  const reasonShort =
    reason.length > 160 ? `${reason.slice(0, 157).trim()}…` : reason;
  const tone =
    tag === "BLOCK"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
      : tag === "GUIDE"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-cyan-500/40 bg-cyan-500/10 text-cyan-200";

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-wide ${tone}`}>
          {tag}
        </span>
        <span className="text-sm font-semibold text-slate-100">{symbol}</span>
        <span className="ml-auto text-xs text-slate-400">{confidence}% confidence</span>
      </div>
      <p className="mt-3 text-sm text-slate-300">{reasonShort}</p>
      <button
        type="button"
        className="mt-3 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300"
        onClick={onAction}
      >
        {ctaLabel}
      </button>
    </article>
  );
}
