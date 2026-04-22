import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { MarketStock } from "../../../hooks/useMarketExplorer";
import type { DecisionCardProps } from "../../../components/decision/DecisionCard";
import { resolveMarketDecisionCard } from "../../../hooks/useMarketDecisions";
import {
  buildDecisionContextSummaryLines,
  buildDecisionReasonBullets,
  buildSuggestedAction,
} from "../decisionContextSummary";
import { formatMarketPrice } from "../marketsFormat";
import FundamentalsPanel from "./FundamentalsPanel";
import TechnicalsPanel from "./TechnicalsPanel";
import MarketContextPanel from "./MarketContextPanel";
import {
  decisionUiBadgeClass,
  decisionUiLabel,
  softenScannerLanguage,
  tradeSideUiLabel,
} from "../marketsDisplayCopy";

export type DecisionDiscoveryPanelProps = {
  selected: MarketStock;
  marketDecisionItems: DecisionCardProps[];
  onBuildTradePlan: () => void;
};

const BADGE: Record<ReturnType<typeof decisionUiBadgeClass>, string> = {
  emerald: "border-emerald-500/45 bg-emerald-500/10 text-emerald-200",
  amber: "border-amber-500/45 bg-amber-500/10 text-amber-200",
  rose: "border-rose-500/45 bg-rose-500/10 text-rose-200",
};

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

export default function DecisionDiscoveryPanel({
  selected,
  marketDecisionItems,
  onBuildTradePlan,
}: DecisionDiscoveryPanelProps) {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const symKey = selected.fullSymbol ?? selected.symbol;

  useEffect(() => {
    setAnalysisOpen(false);
  }, [selected.symbol]);

  const card = useMemo(
    () => resolveMarketDecisionCard(selected, marketDecisionItems),
    [selected, marketDecisionItems],
  );

  const bullets = useMemo(
    () => buildDecisionReasonBullets(card.decision, selected),
    [card.decision, selected],
  );

  const whyLines = useMemo(() => {
    const contextFirst = buildDecisionContextSummaryLines(card.decision, selected)[0] ?? "";
    const base = [
      softenScannerLanguage(bullets.trend),
      softenScannerLanguage(bullets.volume),
      softenScannerLanguage(contextFirst),
      softenScannerLanguage(buildSuggestedAction(card.decision)),
    ];
    return base.map((s) => s.trim()).filter(Boolean).slice(0, 4);
  }, [bullets, card.decision, selected]);

  const riskPoints = useMemo(() => {
    const pts: string[] = [softenScannerLanguage(bullets.risk)];
    if (selected.trend === "BEARISH") {
      pts.push("Tape favors sellers — define invalidation before adding risk.");
    }
    if (selected.changePercent < -1.5) {
      pts.push("Weak session — expect wider spreads and faster stops.");
    }
    if (card.decision.action === "BLOCK") {
      pts.push("This setup does not pass risk checks — stand down until conditions improve.");
    }
    if (selected.isFallback || selected.isSynthetic) {
      pts.push("Quotes may be best-effort — confirm price and size on your broker.");
    }
    return pts.slice(0, 4);
  }, [bullets.risk, selected, card.decision.action]);

  const side = tradeSideUiLabel(selected.trend);
  const sideCls = side === "BUY" ? "text-emerald-300" : "text-slate-400";
  const badge = decisionUiBadgeClass(card.decision.action);
  const decLabel = decisionUiLabel(card.decision.action);

  const price =
    selected.pricePaise > 0 ? formatMarketPrice(selected.pricePaise, selected.isFallback) : "—";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* A — Decision header */}
      <header className="shrink-0 space-y-4 border-b border-slate-800/90 bg-slate-950/80 px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Decision brief</p>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-50">{selected.symbol}</span>
              <span className="text-base tabular-nums text-slate-300">{price}</span>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  selected.changePercent >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {selected.changePercent > 0 ? "+" : ""}
                {selected.changePercent.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Confidence</p>
            <p className="text-3xl font-bold tabular-nums leading-none text-cyan-300">
              {card.decision.confidence}
              <span className="text-xl font-semibold text-cyan-400/80">%</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${BADGE[badge]}`}
          >
            {decLabel}
          </span>
          <span className="text-slate-600" aria-hidden>
            →
          </span>
          <span className={`text-sm font-bold uppercase tracking-wide ${sideCls}`}>{side}</span>
        </div>
      </header>

      {/* B — Primary CTA (always visible) */}
      <div className="shrink-0 border-b border-slate-800/90 bg-slate-950/90 px-4 py-3 md:px-5">
        <button
          type="button"
          onClick={onBuildTradePlan}
          className="w-full min-h-11 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-400"
        >
          Build trade plan
        </button>
      </div>

      {/* C + D (+ collapsible E) — scroll */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 md:px-5">
        <section className="space-y-2" aria-labelledby="mkt-why">
          <SectionTitle id="mkt-why">Why this works</SectionTitle>
          <ul className="space-y-2 text-sm leading-snug text-slate-300">
            {whyLines.map((line, i) => (
              <li key={`why-${i}-${line.slice(0, 20)}`} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500/80" aria-hidden />
                <span className="line-clamp-3 min-w-0">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2 rounded-xl border border-slate-800/90 bg-slate-900/50 p-4" aria-labelledby="mkt-risk">
          <SectionTitle id="mkt-risk">Risk</SectionTitle>
          <ul className="space-y-2 text-sm leading-snug text-slate-200">
            {riskPoints.map((p, i) => (
              <li key={`risk-${i}-${p.slice(0, 20)}`} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/70" aria-hidden />
                <span className="min-w-0">{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-800/90 bg-slate-950/50">
          <button
            type="button"
            id="mkt-analysis"
            aria-expanded={analysisOpen}
            onClick={() => setAnalysisOpen((o) => !o)}
            className="flex w-full min-h-11 items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-slate-800/50"
          >
            <span>Analysis</span>
            <span className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">{analysisOpen ? "Hide" : "Show"}</span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-slate-400 transition-transform ${analysisOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </span>
          </button>
          {analysisOpen ? (
            <div className="space-y-4 border-t border-slate-800/80 p-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Market context</p>
                <MarketContextPanel symbol={symKey} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3">
                  <FundamentalsPanel symbol={symKey} selected={selected} />
                </div>
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3">
                  <TechnicalsPanel symbol={symKey} selected={selected} />
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
