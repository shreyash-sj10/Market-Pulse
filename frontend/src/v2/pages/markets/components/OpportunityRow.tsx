import type { MarketStock } from "../../../hooks/useMarketExplorer";
import type { DecisionCardProps } from "../../../components/decision/DecisionCard";
import { formatMarketPrice } from "../marketsFormat";
import {
  decisionUiBadgeClass,
  decisionUiLabel,
  oneLineListReason,
} from "../marketsDisplayCopy";

const BADGE: Record<ReturnType<typeof decisionUiBadgeClass>, string> = {
  emerald: "border-emerald-500/45 bg-emerald-500/10 text-emerald-200",
  amber: "border-amber-500/45 bg-amber-500/10 text-amber-200",
  rose: "border-rose-500/45 bg-rose-500/10 text-rose-200",
};

export type OpportunityRowProps = {
  stock: MarketStock;
  card: DecisionCardProps;
  rank: number;
  active: boolean;
  onSelect: () => void;
};

export default function OpportunityRow({ stock, card, rank, active, onSelect }: OpportunityRowProps) {
  const { decision } = card;
  const badge = decisionUiBadgeClass(decision.action);
  const label = decisionUiLabel(decision.action);
  const chgUp = stock.changePercent >= 0;
  const reasonLine = oneLineListReason(decision);
  const price =
    stock.pricePaise > 0 ? formatMarketPrice(stock.pricePaise, stock.isFallback) : "—";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border py-4 pl-3 pr-4 text-left transition md:pl-4 md:pr-5 ${
        active
          ? "border-cyan-500/55 bg-cyan-500/[0.08] shadow-[inset_4px_0_0_0_rgb(34,211,238)] ring-1 ring-cyan-500/25"
          : "border-slate-800/90 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/70"
      }`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span className="mt-1 w-9 shrink-0 text-center text-xs font-bold tabular-nums text-slate-500">
          #{rank}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="text-base font-semibold tabular-nums tracking-tight text-slate-100">{stock.symbol}</span>
              <span className="text-sm tabular-nums text-slate-300">{price}</span>
            </div>
            <span
              className={`shrink-0 text-sm font-semibold tabular-nums ${chgUp ? "text-emerald-300" : "text-rose-300"}`}
            >
              {stock.changePercent > 0 ? "+" : ""}
              {stock.changePercent.toFixed(2)}%
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${BADGE[badge]}`}
            >
              {label}
            </span>
            <span className="text-xs font-medium text-slate-500">
              {decision.confidence}%
              <span className="text-slate-600"> confidence</span>
            </span>
          </div>
          <p className="line-clamp-2 text-sm leading-snug text-slate-400">{reasonLine}</p>
        </div>
      </div>
    </button>
  );
}
